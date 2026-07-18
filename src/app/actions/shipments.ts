"use server";

import { requireAppSession } from "@/lib/auth/session";
import { canAccessWarehouse, sessionHasPermission } from "@/lib/auth/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import { recordActivityHistory } from "@/lib/activity-history";
import { logisticsScheduleWindowPatch } from "@/lib/logistics-schedule-window";
import { readBillingFromPlan } from "@/lib/invoice-billing";
import { formatMoneyValue } from "@/lib/logistics-fees";
import {
  DEFAULT_PAYMENT_METHOD,
  isPaymentMethod,
  paymentMethodLabel,
  type PaymentMethod,
} from "@/lib/payment-methods";
import { isAssignableRouteMemberRole } from "@/lib/route-members";
import {
  canManageAllShipments,
  canChangeShipmentSalesOwner,
  shipmentVisibilityScope,
} from "@/lib/shipment-visibility";
import {
  shipmentContactLogAuditDescription,
  validateShipmentContactLogInput,
  type ShipmentContactChannel,
  type ShipmentContactLogInput,
  type ShipmentContactLogRow,
  type ShipmentContactOutcome,
} from "@/lib/shipment-contact-log";
import {
  isSalesOwnerRole,
  shipmentOwnershipInsert,
} from "@/lib/shipment-sales-owner";
import {
  describeLogisticsAuditChange,
  describeLogisticsTaskOrdered,
  describeStatusAuditChange,
  logisticsLegSnapshot,
  type ShipmentAuditContext,
} from "@/lib/shipment-audit";
import {
  applyScheduleChangeMetadata,
  describeScheduleAuditChange,
  detectLegScheduleChanges,
  hasLogisticsPlanChangeBesidesSchedule,
  isoToPlanScheduleAt,
  planLegRecord,
  scheduleAuditMetadata,
  scheduleAuditTitle,
  scheduleChangeFromTaskType,
  SHIPMENT_SCHEDULE_UPDATED_ACTION,
} from "@/lib/shipment-schedule-history";
import {
  EMPTY_BOX_LEG_LABELS,
  FULL_BOX_LEG_LABELS,
} from "@/lib/shipment-leg-labels";
import {
  buildFirstMilestonePatch,
  milestoneKeyForLogisticsTask,
  milestoneKeyForStatus,
  newlyRecordedMilestones,
  readShipmentMilestones,
  shipmentMilestoneAuditPayload,
  type ShipmentMilestoneKey,
  type ShipmentMilestoneSource,
} from "@/lib/shipment-milestones";
import {
  buildUpdatedLogisticsPlan,
  logisticsTaskSyncPlan,
  validateLogisticsPlanUpdate,
  type UpdateShipmentLogisticsPlanInput,
} from "@/lib/shipment-logistics-edit";
import { FULL_BOX_OFFICE_MODE } from "@/components/sale/venta-parts";
import {
  isLogisticsTaskReactivation,
  logisticsTaskAssignedPatch,
  logisticsTaskCancelPatch,
  logisticsTaskLoadedPatch,
  logisticsTaskOrderInsertPatch,
  logisticsTaskReactivatePatch,
  logisticsTaskReactivatePatchPreservingStock,
} from "@/lib/shipment-logistics-task-timestamps";
import {
  formatBoxQuantityLabel,
  isPendingShipmentStatus,
  resolveInitialShipmentStatus,
  syncShipmentStatusPatch,
} from "@/lib/shipment-display";
import { invoiceBoxCode } from "@/lib/invoice-child-codes";
import { physicalPackageCodesForShipment } from "@/lib/physical-packages";
import {
  assertSameOrgCustomerIds,
  assertSameOrgProfileIds,
  assertSameOrgRecipientIds,
  assertSameOrgWarehouseIds,
} from "@/lib/security/org-scope";
import { recordInventoryMovementAtomic } from "@/lib/security/inventory-movement";
import { readPositiveIntegerQty } from "@/lib/security/qty";
import type { AppSession, RoleSlug } from "@/lib/auth/types";

export type ShipmentStatus =
  | "Pendiente entrega caja vacía"
  | "Pendiente recolección caja llena"
  | "En oficina"
  | "Pickup"
  | "Enviado"
  | "Entregado";

export type ShipmentSaleKind = "full" | "empty_box_deposit";
export type InvoiceStatus = "open" | "paid" | "void";
export type AccountingStatus = "not_exportable" | "exportable";

export type LogisticsTaskType = "deliver_empty_box" | "pickup_full_box";
export type LogisticsTaskStatus =
  | "pending"
  | "scheduled"
  | "assigned"
  | "loaded_to_truck"
  | "completed"
  | "cancelled";

type ShipmentPaymentKind = "deposit" | "balance" | "full";

type ShipmentPaymentRow = {
  id: string;
  shipmentId: string;
  amount: number;
  method: PaymentMethod;
  kind: ShipmentPaymentKind;
  note: string;
  createdBy: string | null;
  createdAt: string;
};

export type ShipmentLogisticsTaskRow = {
  id: string;
  shipmentId: string;
  taskType: LogisticsTaskType;
  status: LogisticsTaskStatus;
  assignedTo: string | null;
  scheduledAt: string | null;
  requestedScheduleAt?: string | null;
  scheduleConfirmationStatus?: "pending" | "confirmed";
  scheduleKind?: "exact" | "range" | "from" | null;
  windowStartAt?: string | null;
  windowEndAt?: string | null;
  warehouseId: string | null;
  notes: string;
  stockDeductedAt: string | null;
  completedAt: string | null;
  orderedAt: string | null;
  assignedAt: string | null;
  loadedAt: string | null;
  createdAt: string;
};

export type ShipmentRow = {
  id: string;
  code: string;
  customerId: string | null;
  recipientId: string | null;
  recipientSnapshot: Record<string, unknown> | null;
  customerPhone?: string | null;
  customerSearchText?: string | null;
  customer_name: string;
  country: string;
  carrier: string;
  paid: number;
  profit: number;
  status: ShipmentStatus;
  assigned_to: string | null;
  createdBy: string | null;
  salesOwnerId: string | null;
  salesOwnerName: string;
  sale_kind: ShipmentSaleKind;
  invoice_status: InvoiceStatus;
  invoice_priority: boolean;
  accounting_status: AccountingStatus;
  created_at: string | null;
  finalized_at: string | null;
  empty_box_delivered_at: string | null;
  full_box_collected_at: string | null;
  office_received_at: string | null;
  departed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  delivery_notes: string;
  logistics_plan: Record<string, unknown>;
  invoiceBoxEvidence?: {
    totalBoxes: number;
    markedBoxes: number;
    pickupConfirmedBoxes: number;
    incidentBoxes: number;
    incidentReason: string;
  };
  logisticsTasks: ShipmentLogisticsTaskRow[];
  payments: ShipmentPaymentRow[];
  contactLogs?: ShipmentContactLogRow[];
};

export type RouteMemberRow = {
  id: string;
  label: string;
  roleSlug: RoleSlug;
};

export type SalesOwnerRow = {
  id: string;
  label: string;
  roleSlug: RoleSlug;
};

export type CreateLogisticsTaskInput = {
  taskType: LogisticsTaskType;
  status?: LogisticsTaskStatus;
  scheduledAt?: string | null;
  warehouseId?: string | null;
  notes?: string;
};

type LogisticsTaskDbRow = {
  id: string;
  shipment_id: string;
  task_type: LogisticsTaskType;
  status: LogisticsTaskStatus;
  assigned_to: string | null;
  scheduled_at: string | null;
  requested_schedule_at?: string | null;
  schedule_confirmation_status?: "pending" | "confirmed" | null;
  schedule_kind: "exact" | "range" | "from" | null;
  window_start_at: string | null;
  window_end_at: string | null;
  warehouse_id: string | null;
  notes: string | null;
  stock_deducted_at: string | null;
  completed_at: string | null;
  ordered_at: string | null;
  assigned_at: string | null;
  loaded_at: string | null;
  created_at: string;
};

type ShipmentPaymentDbRow = {
  id: string;
  shipment_id: string;
  amount: number;
  method: string;
  kind: ShipmentPaymentKind;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

type ShipmentContactLogDbRow = {
  id: string;
  shipment_id: string;
  channel: ShipmentContactChannel;
  channel_other?: string | null;
  outcome: ShipmentContactOutcome;
  note: string | null;
  next_step: string | null;
  follow_up_at: string | null;
  created_by: string | null;
  created_by_profile?: ProfileLabelRow | ProfileLabelRow[] | null;
  created_at: string;
};

type ShipmentDbRow = {
  id: string;
  code: string;
  customer_id?: string | null;
  recipient_id?: string | null;
  recipient_snapshot?: Record<string, unknown> | null;
  customer?:
    | {
        first_name?: string | null;
        last_name?: string | null;
        phones?: string[] | null;
        email?: string | null;
        emails?: string[] | null;
        street?: string | null;
        house_number?: string | null;
        neighborhood?: string | null;
        city?: string | null;
        state?: string | null;
        postal_code?: string | null;
        country?: string | null;
        formatted_address?: string | null;
      }
    | {
        first_name?: string | null;
        last_name?: string | null;
        phones?: string[] | null;
        email?: string | null;
        emails?: string[] | null;
        street?: string | null;
        house_number?: string | null;
        neighborhood?: string | null;
        city?: string | null;
        state?: string | null;
        postal_code?: string | null;
        country?: string | null;
        formatted_address?: string | null;
      }[]
    | null;
  customer_name: string;
  country: string;
  carrier: string;
  paid: number;
  profit: number;
  status: ShipmentStatus;
  assigned_to: string | null;
  created_by?: string | null;
  sales_owner_id?: string | null;
  sales_owner_profile?: ProfileLabelRow | ProfileLabelRow[] | null;
  sale_kind?: ShipmentSaleKind | null;
  invoice_status?: InvoiceStatus | null;
  invoice_priority?: boolean | null;
  accounting_status?: AccountingStatus | null;
  created_at?: string | null;
  finalized_at?: string | null;
  empty_box_delivered_at?: string | null;
  full_box_collected_at?: string | null;
  office_received_at?: string | null;
  departed_at?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
  delivery_notes?: string | null;
  logistics_plan?: Record<string, unknown> | null;
  shipment_logistics_tasks?: LogisticsTaskDbRow[] | null;
  shipment_payments?: ShipmentPaymentDbRow[] | null;
  shipment_contact_logs?: ShipmentContactLogDbRow[] | null;
  shipment_packages?: Array<{
    id: string;
    invoice_marked_at?: string | null;
    invoice_pickup_confirmed_at?: string | null;
    invoice_incident_at?: string | null;
    invoice_incident_reason?: string | null;
  }> | null;
};

type ProfileLabelRow = {
  full_name?: string | null;
  email?: string | null;
};

type ShipmentQuote = {
  label: string;
  paid: string;
  cost: string;
  quantity: number;
};

const SHIPMENT_SELECT = `
  id, code, customer_id, recipient_id, recipient_snapshot, customer_name, country, carrier, paid, profit, status, assigned_to,
  customer:customers!shipments_customer_id_fkey(first_name, last_name, phones, email, emails, street, house_number, neighborhood, city, state, postal_code, country, formatted_address),
  created_by, sales_owner_id, sales_owner_profile:profiles!shipments_sales_owner_id_fkey(full_name, email),
  sale_kind, invoice_status, invoice_priority, accounting_status, created_at, finalized_at,
  empty_box_delivered_at, full_box_collected_at, office_received_at, departed_at, shipped_at, delivered_at,
  delivery_notes, logistics_plan,
  shipment_logistics_tasks (
    id, shipment_id, task_type, status, assigned_to, scheduled_at, requested_schedule_at, schedule_confirmation_status, schedule_kind, window_start_at, window_end_at, warehouse_id,
    notes, stock_deducted_at, completed_at, ordered_at, assigned_at, loaded_at, created_at
  ),
  shipment_payments (
    id, shipment_id, amount, method, kind, note, created_by, created_at
  ),
  shipment_contact_logs (
    id, shipment_id, channel, channel_other, outcome, note, next_step, follow_up_at, created_by, created_at,
    created_by_profile:profiles!shipment_contact_logs_created_by_fkey(full_name, email)
  ),
  shipment_packages (
    id, invoice_marked_at, invoice_pickup_confirmed_at, invoice_incident_at, invoice_incident_reason
  )
`;

function parseMoney(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  return Number(String(value || "").replace(/[^\d.-]/g, "")) || 0;
}

function readPaymentMethod(value: unknown): PaymentMethod {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_PAYMENT_METHOD;
  }

  if (isPaymentMethod(value)) {
    return value;
  }

  throw new Error("Forma de pago invalida");
}

function cleanPaymentNote(value: unknown) {
  return String(value || "").trim().slice(0, 160);
}

function normalizeInventoryText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readQuoteFromPlan(value: unknown): ShipmentQuote | null {
  const lines = readQuoteLinesFromPlan(value);

  if (lines.length) {
    return {
      label: lines.map((line) => formatBoxQuantityLabel(line.label, line.quantity)).join(" + "),
      paid: formatMoneyValue(
        lines.reduce((sum, line) => sum + parseMoney(line.paid) * line.quantity, 0),
      ),
      cost: formatMoneyValue(
        lines.reduce((sum, line) => sum + parseMoney(line.cost) * line.quantity, 0),
      ),
      quantity: lines.reduce((sum, line) => sum + line.quantity, 0),
    };
  }

  return null;
}

function readQuoteLinesFromPlan(value: unknown): ShipmentQuote[] {
  const plan = asRecord(value);
  const rawLines = Array.isArray(plan.boxLines) ? plan.boxLines : [];
  const boxLines = rawLines
    .map((entry) => {
      const line = asRecord(entry);
      const label = String(line.label || "").trim();

      if (!label) {
        return null;
      }

      return {
        label,
        paid: String(line.paid || "0"),
        cost: String(line.cost || "0"),
        quantity: Math.max(Number(line.quantity) || 1, 1),
      } satisfies ShipmentQuote;
    })
    .filter((line): line is ShipmentQuote => Boolean(line));

  if (boxLines.length) {
    return boxLines;
  }

  const box = asRecord(plan.box);
  const label = String(box.label || box.name || "").trim();

  if (!label) {
    return [];
  }

  return [
    {
      label,
      paid: String(box.paid || "0"),
      cost: String(box.cost || "0"),
      quantity: Math.max(Number(plan.boxCount) || 1, 1),
    },
  ];
}

function mapTask(row: LogisticsTaskDbRow): ShipmentLogisticsTaskRow {
  return {
    id: row.id,
    shipmentId: row.shipment_id,
    taskType: row.task_type,
    status: row.status,
    assignedTo: row.assigned_to,
    scheduledAt: row.scheduled_at,
    requestedScheduleAt: row.requested_schedule_at || null,
    scheduleConfirmationStatus: row.schedule_confirmation_status || "confirmed",
    scheduleKind: row.schedule_kind || (row.scheduled_at ? "exact" : null),
    windowStartAt: row.window_start_at || row.scheduled_at,
    windowEndAt: row.window_end_at,
    warehouseId: row.warehouse_id,
    notes: row.notes || "",
    stockDeductedAt: row.stock_deducted_at,
    completedAt: row.completed_at,
    orderedAt: row.ordered_at,
    assignedAt: row.assigned_at,
    loadedAt: row.loaded_at,
    createdAt: row.created_at,
  };
}

function mapPayment(row: ShipmentPaymentDbRow): ShipmentPaymentRow {
  return {
    id: row.id,
    shipmentId: row.shipment_id,
    amount: Number(row.amount) || 0,
    method: isPaymentMethod(row.method) ? row.method : DEFAULT_PAYMENT_METHOD,
    kind: row.kind,
    note: row.note || "",
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function mapContactLog(row: ShipmentContactLogDbRow): ShipmentContactLogRow {
  return {
    id: row.id,
    shipmentId: row.shipment_id,
    channel: row.channel,
    channelOther: row.channel_other || "",
    outcome: row.outcome,
    note: row.note || "",
    nextStep: row.next_step || "",
    followUpAt: row.follow_up_at || null,
    createdBy: row.created_by || null,
    createdByName: profileLabel(row.created_by_profile) || "Sin vendedor",
    createdAt: row.created_at,
  };
}

function profileLabel(profile: ProfileLabelRow | ProfileLabelRow[] | null | undefined) {
  const row = Array.isArray(profile) ? profile[0] : profile;
  return ((row?.full_name || row?.email || "") as string).trim();
}

function customerPhone(row: ShipmentDbRow) {
  const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
  const phones = Array.isArray(customer?.phones) ? customer.phones : [];
  return String(phones[0] || "").trim() || null;
}

function customerSearchText(row: ShipmentDbRow) {
  const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;

  if (!customer) {
    return null;
  }

  return [
    customer.first_name,
    customer.last_name,
    ...(Array.isArray(customer.phones) ? customer.phones : []),
    customer.email,
    ...(Array.isArray(customer.emails) ? customer.emails : []),
    customer.street,
    customer.house_number,
    customer.neighborhood,
    customer.city,
    customer.state,
    customer.postal_code,
    customer.country,
    customer.formatted_address,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");
}

function mapShipment(row: ShipmentDbRow): ShipmentRow {
  const tasks = (row.shipment_logistics_tasks || [])
    .map(mapTask)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const payments = (row.shipment_payments || [])
    .map(mapPayment)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const contactLogs = (row.shipment_contact_logs || [])
    .map(mapContactLog)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const invoicePackages = row.shipment_packages || [];
  const invoiceBoxEvidence = invoicePackages.length
    ? {
        totalBoxes: invoicePackages.length,
        markedBoxes: invoicePackages.filter((pkg) => Boolean(pkg.invoice_marked_at)).length,
        pickupConfirmedBoxes: invoicePackages.filter((pkg) => Boolean(pkg.invoice_pickup_confirmed_at)).length,
        incidentBoxes: invoicePackages.filter((pkg) => Boolean(pkg.invoice_incident_at)).length,
        incidentReason: invoicePackages.find((pkg) => pkg.invoice_incident_reason)?.invoice_incident_reason || "",
      }
    : undefined;

  return {
    id: row.id,
    code: row.code,
    customerId: row.customer_id || null,
    recipientId: row.recipient_id || null,
    recipientSnapshot: row.recipient_snapshot || null,
    customerPhone: customerPhone(row),
    customerSearchText: customerSearchText(row),
    customer_name: row.customer_name,
    country: row.country,
    carrier: row.carrier,
    paid: Number(row.paid) || 0,
    profit: Number(row.profit) || 0,
    status: row.status,
    assigned_to: row.assigned_to,
    createdBy: row.created_by || null,
    salesOwnerId: row.sales_owner_id || null,
    salesOwnerName: profileLabel(row.sales_owner_profile) || "Sin vendedor",
    sale_kind: row.sale_kind || "full",
    invoice_status: row.invoice_status || (row.sale_kind === "empty_box_deposit" ? "open" : "paid"),
    invoice_priority: row.invoice_priority === true,
    accounting_status:
      row.accounting_status ||
      (row.sale_kind === "empty_box_deposit" ? "not_exportable" : "exportable"),
    created_at: row.created_at || null,
    finalized_at: row.finalized_at || null,
    empty_box_delivered_at: row.empty_box_delivered_at || null,
    full_box_collected_at: row.full_box_collected_at || null,
    office_received_at: row.office_received_at || null,
    departed_at: row.departed_at || null,
    shipped_at: row.shipped_at || null,
    delivered_at: row.delivered_at || null,
    delivery_notes: row.delivery_notes || "",
    logistics_plan: row.logistics_plan || {},
    invoiceBoxEvidence,
    logisticsTasks: tasks,
    payments,
    contactLogs,
  };
}

async function recordShipmentPayment(
  supabase: NonNullable<Awaited<ReturnType<typeof createScopedSupabase>>>,
  session: AppSession,
  input: {
    shipmentId: string;
    amount: number;
    method: PaymentMethod;
    kind: ShipmentPaymentKind;
    note?: string;
  },
) {
  if (input.amount <= 0) {
    return;
  }

  const { error } = await supabase.from("shipment_payments").insert({
    organization_id: session.organizationId,
    shipment_id: input.shipmentId,
    amount: input.amount,
    method: input.method,
    kind: input.kind,
    note: cleanPaymentNote(input.note),
    created_by: session.userId,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function recordShipmentMilestoneAudits(
  supabase: NonNullable<Awaited<ReturnType<typeof createScopedSupabase>>>,
  session: AppSession,
  shipment: Pick<ShipmentRow, "id" | "code" | "customer_name" | "country">,
  milestones: Array<{ key: ShipmentMilestoneKey; recordedAt: string }>,
  source: ShipmentMilestoneSource,
  context?: {
    previousStatus?: string;
    nextStatus?: string;
    taskId?: string;
    taskType?: string;
    audit?: ShipmentAuditContext;
  },
) {
  for (const milestone of milestones) {
    await recordActivityHistory(
      supabase,
      session,
      shipmentMilestoneAuditPayload({
        shipmentId: shipment.id,
        shipmentCode: shipment.code,
        milestone: milestone.key,
        recordedAt: milestone.recordedAt,
        source,
        customerName: shipment.customer_name,
        country: shipment.country,
        previousStatus: context?.previousStatus,
        nextStatus: context?.nextStatus,
        taskId: context?.taskId,
        taskType: context?.taskType,
        actorInteraction: context?.audit?.interaction,
        stepTitle: context?.audit?.stepTitle || null,
        stepKind: context?.audit?.stepKind || null,
      }),
    );
  }
}

async function applyShipmentMilestonePatch(
  supabase: NonNullable<Awaited<ReturnType<typeof createScopedSupabase>>>,
  session: AppSession,
  shipment: ShipmentRow,
  entries: Array<{ key: ShipmentMilestoneKey | null; recordedAt: string }>,
  source: ShipmentMilestoneSource,
  context?: {
    previousStatus?: string;
    nextStatus?: string;
    taskId?: string;
    taskType?: string;
    audit?: ShipmentAuditContext;
  },
): Promise<ShipmentRow> {
  const before = readShipmentMilestones(shipment);
  const patch = buildFirstMilestonePatch(
    before,
    entries.filter((entry): entry is { key: ShipmentMilestoneKey; recordedAt: string } =>
      Boolean(entry.key),
    ),
  );

  if (!Object.keys(patch).length) {
    return shipment;
  }

  const { data, error } = await supabase
    .from("shipments")
    .update(patch)
    .eq("id", shipment.id)
    .eq("organization_id", session.organizationId)
    .select(SHIPMENT_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message || "No se pudo registrar hito del envío");
  }

  const updated = mapShipment(data as unknown as ShipmentDbRow);
  const recorded = newlyRecordedMilestones(before, patch);

  await recordShipmentMilestoneAudits(supabase, session, updated, recorded, source, context);

  return persistShipmentStatusSync(supabase, session, updated);
}

async function persistShipmentStatusSync(
  supabase: NonNullable<Awaited<ReturnType<typeof createScopedSupabase>>>,
  session: AppSession,
  shipment: ShipmentRow,
): Promise<ShipmentRow> {
  const statusPatch = syncShipmentStatusPatch(shipment);

  if (!statusPatch.status || statusPatch.status === shipment.status) {
    return shipment;
  }

  const { data, error } = await supabase
    .from("shipments")
    .update({ status: statusPatch.status })
    .eq("id", shipment.id)
    .eq("organization_id", session.organizationId)
    .select(SHIPMENT_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message || "No se pudo sincronizar el estado del envío");
  }

  return mapShipment(data as unknown as ShipmentDbRow);
}

function canManageRoutes(session: AppSession) {
  return (
    sessionHasPermission(session, "routes.update_status") ||
    sessionHasPermission(session, "sales.manage")
  );
}

type PersistLogisticsPlanResult =
  | { ok: true; shipment: ShipmentRow }
  | { ok: false; error: string };

async function persistShipmentLogisticsPlanUpdate(
  supabase: NonNullable<Awaited<ReturnType<typeof createScopedSupabase>>>,
  session: AppSession,
  shipment: ShipmentRow,
  input: UpdateShipmentLogisticsPlanInput,
  audit?: ShipmentAuditContext,
): Promise<PersistLogisticsPlanResult> {
  const beforePlan = { ...(shipment.logistics_plan || {}) };
  const { logisticsPlan: rawLogisticsPlan, deliveryNotes } = buildUpdatedLogisticsPlan(shipment, input);
  const actorName = session.fullName || session.email;
  const changedAt = new Date().toISOString();
  const scheduleChanges = detectLegScheduleChanges(beforePlan, rawLogisticsPlan);
  const logisticsPlan = applyScheduleChangeMetadata(
    beforePlan,
    rawLogisticsPlan,
    actorName,
    changedAt,
  );
  const nonScheduleChange = hasLogisticsPlanChangeBesidesSchedule(beforePlan, logisticsPlan);
  const taskSync = logisticsTaskSyncPlan(shipment, input);
  const orderedTaskEvents: Array<{
    taskType: "deliver_empty_box" | "pickup_full_box";
    orderedAt: string;
    scheduleMode: string;
    scheduleAt: string | null;
  }> = [];

  for (const spec of taskSync) {
    if (!spec.existing) {
      if (spec.needed) {
        const orderedAt = new Date().toISOString();
        const { error } = await supabase.from("shipment_logistics_tasks").insert({
          organization_id: session.organizationId,
          shipment_id: shipment.id,
          task_type: spec.taskType,
          status: spec.scheduleMode === "scheduled" && spec.scheduleAt ? "scheduled" : "pending",
          ...logisticsScheduleWindowPatch(spec.scheduleAt),
          notes: String(shipment.logistics_plan?.notes || ""),
          ...logisticsTaskOrderInsertPatch(orderedAt),
        });

        if (error) {
          return { ok: false, error: error.message };
        }

        orderedTaskEvents.push({
          taskType: spec.taskType,
          orderedAt,
          scheduleMode: spec.scheduleMode,
          scheduleAt: spec.scheduleAt,
        });
      }

      continue;
    }

    if (!spec.needed) {
      if (spec.existing.status !== "completed" && spec.existing.status !== "cancelled") {
        const { error } = await supabase
          .from("shipment_logistics_tasks")
          .update({
            status: "cancelled",
            updated_at: new Date().toISOString(),
            ...logisticsTaskCancelPatch(),
          })
          .eq("id", spec.existing.id)
          .eq("organization_id", session.organizationId);

        if (error) {
          return { ok: false, error: error.message };
        }
      }

      continue;
    }

    if (spec.existing.status === "completed") {
      continue;
    }

    const nextStatus =
      spec.scheduleMode === "scheduled" && spec.scheduleAt ? "scheduled" : "pending";
    const reactivating = isLogisticsTaskReactivation(spec.existing);
    const orderedAt = reactivating ? new Date().toISOString() : spec.existing.orderedAt;

    const { error } = await supabase
      .from("shipment_logistics_tasks")
      .update({
        status: nextStatus,
        ...logisticsScheduleWindowPatch(spec.scheduleAt),
        updated_at: new Date().toISOString(),
        ...(reactivating ? logisticsTaskReactivatePatch(orderedAt as string) : {}),
      })
      .eq("id", spec.existing.id)
      .eq("organization_id", session.organizationId);

    if (error) {
      return { ok: false, error: error.message };
    }

    if (reactivating && orderedAt) {
      orderedTaskEvents.push({
        taskType: spec.taskType,
        orderedAt,
        scheduleMode: spec.scheduleMode,
        scheduleAt: spec.scheduleAt,
      });
    }
  }

  const { error: updateError } = await supabase
    .from("shipments")
    .update({
      logistics_plan: logisticsPlan,
      delivery_notes: deliveryNotes,
    })
    .eq("id", shipment.id)
    .eq("organization_id", session.organizationId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  if (nonScheduleChange) {
    await recordActivityHistory(supabase, session, {
      action: "shipment.logistics_plan_updated",
      entityType: "shipment",
      entityId: shipment.id,
      title: `Logística · ${shipment.code}`,
      description: audit
        ? describeLogisticsAuditChange({
            before: beforePlan,
            after: logisticsPlan,
            interaction: audit.interaction,
            stepTitle: audit.stepTitle,
          })
        : deliveryNotes,
      metadata: {
        shipmentCode: shipment.code,
        source: audit?.source || "envios",
        interaction: audit?.interaction || null,
        stepTitle: audit?.stepTitle || null,
        stepKind: audit?.stepKind || null,
        before: {
          emptyBox: logisticsLegSnapshot(beforePlan, "emptyBox"),
          fullBox: logisticsLegSnapshot(beforePlan, "fullBox"),
        },
        after: {
          emptyBox: logisticsLegSnapshot(logisticsPlan, "emptyBox"),
          fullBox: logisticsLegSnapshot(logisticsPlan, "fullBox"),
        },
        deliveryNotes,
      },
    });
  }

  for (const change of scheduleChanges) {
    await recordActivityHistory(supabase, session, {
      action: SHIPMENT_SCHEDULE_UPDATED_ACTION,
      entityType: "shipment",
      entityId: shipment.id,
      title: scheduleAuditTitle(shipment.code),
      description: describeScheduleAuditChange({
        beforeScheduleAt: change.beforeScheduleAt,
        afterScheduleAt: change.afterScheduleAt,
        stepTitle: audit?.stepTitle || change.stepTitle,
      }),
      metadata: scheduleAuditMetadata({
        shipmentCode: shipment.code,
        change,
        source: audit?.source || "envios",
        interaction: audit?.interaction || null,
        stepTitle: audit?.stepTitle || change.stepTitle,
        stepKind: audit?.stepKind || change.stepKind,
      }),
    });
  }

  for (const event of orderedTaskEvents) {
    await recordActivityHistory(supabase, session, {
      action: "shipment.logistics_task_ordered",
      entityType: "shipment",
      entityId: shipment.id,
      title: `Orden logística · ${shipment.code}`,
      description: describeLogisticsTaskOrdered({
        taskType: event.taskType,
        orderedAt: event.orderedAt,
        scheduleMode: event.scheduleMode,
        scheduleAt: event.scheduleAt,
        interaction: audit?.interaction || "context_menu",
        stepTitle: audit?.stepTitle,
      }),
      metadata: {
        shipmentCode: shipment.code,
        taskType: event.taskType,
        orderedAt: event.orderedAt,
        scheduleMode: event.scheduleMode,
        scheduleAt: event.scheduleAt,
        source: audit?.source || "envios",
        interaction: audit?.interaction || null,
        stepTitle: audit?.stepTitle || null,
        stepKind: audit?.stepKind || null,
      },
    });
  }

  const reloaded = await listShipmentById(supabase, session, shipment.id);
  if (!reloaded) {
    return { ok: false, error: "No se pudo recargar el envío" };
  }

  const synced = await persistShipmentStatusSync(supabase, session, reloaded);
  return { ok: true, shipment: synced };
}

async function promoteDueScheduledLegsForListedShipments(
  _supabase: NonNullable<Awaited<ReturnType<typeof createScopedSupabase>>>,
  _session: AppSession,
  shipments: ShipmentRow[],
): Promise<ShipmentRow[]> {
  return shipments;
}

export async function listShipmentsAction(options?: {
  limit?: number;
  offset?: number;
}): Promise<ActionResult<ShipmentRow[]>> {
  try {
    const session = await requireAppSession();
    const scope = shipmentVisibilityScope(session);

    if (scope === "none") {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const limit = Math.min(Math.max(options?.limit ?? 500, 1), 1000);
    const offset = Math.max(options?.offset ?? 0, 0);

    let query = supabase
      .from("shipments")
      .select(SHIPMENT_SELECT)
      .eq("organization_id", session.organizationId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + limit - 1);

    if (scope === "driver") {
      query = query.eq("assigned_to", session.userId);
    } else if (scope === "sales_owner") {
      query = query.eq("sales_owner_id", session.userId);
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === "42P01") {
        return ok([]);
      }
      return fail(error.message);
    }

    return ok(
      await promoteDueScheduledLegsForListedShipments(
        supabase,
        session,
        ((data || []) as unknown as ShipmentDbRow[]).map(mapShipment),
      ),
    );
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function listShipmentsForRouteBoardAction(options?: {
  limit?: number;
  offset?: number;
}): Promise<ActionResult<ShipmentRow[]>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "routes.view")) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const limit = Math.min(Math.max(options?.limit ?? 500, 1), 500);
    const offset = Math.max(options?.offset ?? 0, 0);

    const { data, error } = await supabase
      .from("shipments")
      .select(SHIPMENT_SELECT)
      .eq("organization_id", session.organizationId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      if (error.code === "42P01") {
        return ok([]);
      }
      return fail(error.message);
    }

    return ok(
      await promoteDueScheduledLegsForListedShipments(
        supabase,
        session,
        ((data || []) as unknown as ShipmentDbRow[]).map(mapShipment),
      ),
    );
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function listRouteMembersAction(): Promise<ActionResult<RouteMemberRow[]>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "routes.view") && !sessionHasPermission(session, "sales.manage")) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return ok([]);
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, roles(slug, name)")
      .eq("organization_id", session.organizationId)
      .eq("is_active", true)
      .order("full_name");

    if (error) {
      return fail(error.message);
    }

    const members = (data || [])
      .map((row) => {
        const roleRow = row.roles as { slug: RoleSlug; name: string } | { slug: RoleSlug; name: string }[] | null;
        const role = Array.isArray(roleRow) ? roleRow[0] : roleRow;
        return {
          id: row.id as string,
          label: ((row.full_name as string | null) || (row.email as string) || "Usuario").trim(),
          roleSlug: role?.slug || "vendedor",
        };
      })
      .filter((row) => isAssignableRouteMemberRole(row.roleSlug));

    return ok(members);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function listSalesOwnersAction(): Promise<ActionResult<SalesOwnerRow[]>> {
  try {
    const session = await requireAppSession();

    if (!canChangeShipmentSalesOwner(session)) {
      return ok([]);
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return ok([]);
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, roles(slug, name)")
      .eq("organization_id", session.organizationId)
      .eq("is_active", true)
      .order("full_name");

    if (error) {
      return fail(error.message);
    }

    const owners = (data || [])
      .map((row) => {
        const roleRow = row.roles as { slug: RoleSlug; name: string } | { slug: RoleSlug; name: string }[] | null;
        const role = Array.isArray(roleRow) ? roleRow[0] : roleRow;
        return {
          id: row.id as string,
          label: ((row.full_name as string | null) || (row.email as string) || "Usuario").trim(),
          roleSlug: role?.slug || "vendedor",
        };
      })
      .filter((row) => isSalesOwnerRole(row.roleSlug));

    return ok(owners);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function createShipmentAction(input: {
  invoiceNumber: string;
  customerId?: string;
  recipientId?: string;
  customerName: string;
  country?: string;
  carrier: string;
  paid: string;
  cost: string;
  recipientSnapshot?: Record<string, unknown>;
  saleKind?: ShipmentSaleKind;
  deliveryNotes?: string;
  logisticsPlan?: Record<string, unknown>;
  paymentMethod?: PaymentMethod;
  paymentNote?: string;
  invoiceStatus?: InvoiceStatus;
  accountingStatus?: AccountingStatus;
  logisticsTasks?: CreateLogisticsTaskInput[];
}): Promise<ActionResult<ShipmentRow>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "sales.manage")) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    await assertSameOrgCustomerIds(supabase, session.organizationId, [
      input.customerId || "",
    ]);
    await assertSameOrgRecipientIds(supabase, session.organizationId, [
      input.recipientId || "",
    ]);

    const taskWarehouseIds = (input.logisticsTasks || [])
      .map((task) => task.warehouseId || "")
      .filter(Boolean);

    await assertSameOrgWarehouseIds(supabase, session.organizationId, taskWarehouseIds);

    const paid = parseMoney(input.paid);
    const cost = parseMoney(input.cost);
    const saleKind = input.saleKind || (input.recipientId ? "full" : "empty_box_deposit");
    const country = input.country || "USA";
    const deliveryNotes = input.deliveryNotes || "";
    const invoiceStatus = input.invoiceStatus || "paid";
    const accountingStatus =
      input.accountingStatus || (invoiceStatus === "paid" ? "exportable" : "not_exportable");
    const paymentMethod = readPaymentMethod(input.paymentMethod);
    const paymentNote = cleanPaymentNote(input.paymentNote);
    const logisticsPlan = { ...(input.logisticsPlan || {}) };
    const logisticsTasks = input.logisticsTasks || [];
    const initialStatus = resolveInitialShipmentStatus({
      saleKind,
      logisticsPlan,
      logisticsTasks: logisticsTasks.map((task, index) => ({
        id: `draft-${index}`,
        shipmentId: "",
        taskType: task.taskType,
        status: task.status || (task.scheduledAt ? "scheduled" : "pending"),
        assignedTo: null,
        scheduledAt: task.scheduledAt || null,
        warehouseId: task.warehouseId || null,
        notes: task.notes || "",
        stockDeductedAt: null,
        completedAt: null,
        orderedAt: null,
        assignedAt: null,
        loadedAt: null,
        createdAt: new Date().toISOString(),
      })),
      deliveryNotes,
      emptyBoxDeliveredAt: shouldDeductCounterHandingStock(logisticsPlan)
        ? new Date().toISOString()
        : null,
    });

    const { data, error } = await supabase
      .from("shipments")
      .insert({
        organization_id: session.organizationId,
        code: input.invoiceNumber,
        customer_name: input.customerName,
        country,
        carrier: input.carrier || "Sin carrier",
        paid,
        profit: invoiceStatus === "paid" ? Math.max(paid - cost, 0) : 0,
        status: initialStatus,
        ...shipmentOwnershipInsert(session.userId),
        customer_id: input.customerId || null,
        recipient_id: input.recipientId || null,
        recipient_snapshot: input.recipientSnapshot || null,
        sale_kind: saleKind,
        delivery_notes: deliveryNotes,
        logistics_plan: input.logisticsPlan || {},
        invoice_status: invoiceStatus,
        accounting_status: accountingStatus,
        finalized_at: invoiceStatus === "paid" ? new Date().toISOString() : null,
      })
      .select(SHIPMENT_SELECT)
      .single();

    if (error || !data) {
      return fail(error?.message || "No se pudo registrar el envio");
    }

    let shipment = mapShipment(data as unknown as ShipmentDbRow);
    let shouldReloadShipment = false;

    const { error: packageError } = await supabase.from("shipment_packages").insert(
      physicalPackageCodesForShipment(shipment.code, logisticsPlan).map((code, index) => ({
        organization_id: session.organizationId,
        shipment_id: shipment.id,
        code,
        country: shipment.country || "",
        invoice_code: invoiceBoxCode(shipment.code, index),
        invoice_created_by: session.userId,
        invoice_paid_by: invoiceStatus === "paid" ? session.userId : null,
      })),
    );

    if (packageError) {
      await deleteShipmentWithTasks(supabase, session, shipment.id, shipment.code);
      return fail(packageError.message);
    }

    if (paid > 0) {
      try {
        await recordShipmentPayment(supabase, session, {
          shipmentId: shipment.id,
          amount: paid,
          method: paymentMethod,
          kind: invoiceStatus === "paid" ? "full" : "deposit",
          note: paymentNote,
        });
        shouldReloadShipment = true;
      } catch (paymentError) {
        await deleteShipmentWithTasks(supabase, session, shipment.id, shipment.code);
        return fail(actionErrorMessage(paymentError));
      }
    }

    if (logisticsTasks.length) {
      const { error: taskError } = await supabase.from("shipment_logistics_tasks").insert(
        logisticsTasks.map((task) => ({
          organization_id: session.organizationId,
          shipment_id: shipment.id,
          task_type: task.taskType,
          status: task.status || (task.scheduledAt ? "scheduled" : "pending"),
          ...logisticsScheduleWindowPatch(task.scheduledAt),
          warehouse_id: task.warehouseId || null,
          notes: task.notes || "",
        })),
      );

      if (taskError) {
        await deleteShipmentWithTasks(supabase, session, shipment.id, shipment.code);
        return fail(taskError.message);
      }

      shouldReloadShipment = true;
    }

    if (shouldDeductCounterHandingStock(logisticsPlan)) {
      try {
        const stockResult = await deductEmptyBoxStock({
          session,
          shipment,
          movementNote: `Caja vacia entregada en mostrador ${shipment.code}`,
          assigneeId: session.userId,
        });

        const emptyBox = asRecord(logisticsPlan.emptyBox);
        const nextPlan = {
          ...logisticsPlan,
          emptyBox: {
            ...emptyBox,
            stockDeductedAt: stockResult.deductedAt,
            warehouseId: stockResult.warehouseId,
          },
        };

        const { error: planError } = await supabase
          .from("shipments")
          .update({
            logistics_plan: nextPlan,
            empty_box_delivered_at: stockResult.deductedAt,
          })
          .eq("id", shipment.id)
          .eq("organization_id", session.organizationId);

        if (planError) {
          throw new Error(planError.message);
        }

        shipment.logistics_plan = nextPlan;
        shipment.empty_box_delivered_at = stockResult.deductedAt;

        await recordShipmentMilestoneAudits(
          supabase,
          session,
          shipment,
          [{ key: "empty_box_delivered_at", recordedAt: stockResult.deductedAt }],
          "counter_handoff",
        );

        shipment = await persistShipmentStatusSync(supabase, session, {
          ...shipment,
          logistics_plan: nextPlan,
          empty_box_delivered_at: stockResult.deductedAt,
        });
        shouldReloadShipment = true;
      } catch (stockError) {
        await deleteShipmentWithTasks(supabase, session, shipment.id, shipment.code);
        return fail(actionErrorMessage(stockError));
      }
    }

    const isOpen = invoiceStatus === "open";
    const isEmptyBoxDeposit = saleKind === "empty_box_deposit";

    await recordActivityHistory(supabase, session, {
      action: isOpen ? "sale.open_invoice_created" : isEmptyBoxDeposit ? "sale.empty_box_deposit" : "sale.created",
      entityType: "shipment",
      entityId: shipment.id,
      title: isOpen
        ? `Invoice abierto: ${input.invoiceNumber}`
        : isEmptyBoxDeposit
          ? `Deposito caja vacia: ${input.invoiceNumber}`
          : `Venta registrada: ${input.invoiceNumber}`,
      description: isOpen
        ? `${input.customerName} · ${deliveryNotes || "Logistica pendiente"}`
        : isEmptyBoxDeposit
          ? `${input.customerName} · ${deliveryNotes || "Caja vacia"}`
          : `${input.customerName} · ${country} · ${input.carrier || "Sin carrier"}`,
      metadata: {
        paid,
        cost,
        profit: invoiceStatus === "paid" ? Math.max(paid - cost, 0) : 0,
        customerId: input.customerId || null,
        recipientId: input.recipientId || null,
        saleKind,
        invoiceStatus,
        accountingStatus,
        deliveryNotes,
        paymentMethod: paid > 0 ? paymentMethod : null,
        paymentMethodLabel: paid > 0 ? paymentMethodLabel(paymentMethod) : null,
        paymentNote,
        logisticsPlan: shipment.logistics_plan,
      },
    });

    if (!shouldReloadShipment) {
      return ok(shipment);
    }

    const reloaded = await listShipmentById(supabase, session, shipment.id);
    return reloaded ? ok(reloaded) : ok(shipment);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

async function listShipmentById(
  supabase: Awaited<ReturnType<typeof createScopedSupabase>>,
  session: AppSession,
  shipmentId: string,
) {
  if (!supabase) {
    return null;
  }

  const { data } = await supabase
    .from("shipments")
    .select(SHIPMENT_SELECT)
    .eq("id", shipmentId)
    .eq("organization_id", session.organizationId)
    .maybeSingle();

  return data ? mapShipment(data as unknown as ShipmentDbRow) : null;
}

function canWriteShipmentContactLog(session: AppSession, shipment: ShipmentRow) {
  return (
    canManageAllShipments(session) ||
    (sessionHasPermission(session, "sales.manage") && shipment.salesOwnerId === session.userId)
  );
}

export async function createShipmentContactLogAction(
  input: ShipmentContactLogInput,
): Promise<ActionResult<ShipmentRow>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "sales.manage")) {
      throw new Error("FORBIDDEN");
    }

    const validated = validateShipmentContactLogInput(input);

    if (!validated.ok) {
      return fail(validated.error);
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const shipment = await listShipmentById(supabase, session, validated.data.shipmentId);

    if (!shipment) {
      return fail("Invoice no encontrado");
    }

    if (!canWriteShipmentContactLog(session, shipment)) {
      throw new Error("FORBIDDEN");
    }

    const { error } = await supabase.from("shipment_contact_logs").insert({
      organization_id: session.organizationId,
      shipment_id: shipment.id,
      channel: validated.data.channel,
      channel_other: validated.data.channelOther,
      outcome: validated.data.outcome,
      note: validated.data.note,
      next_step: validated.data.nextStep,
      follow_up_at: validated.data.followUpAt,
      created_by: session.userId,
    });

    if (error) {
      return fail(error.message);
    }

    await recordActivityHistory(supabase, session, {
      action: "shipment.contact_log_created",
      entityType: "shipment",
      entityId: shipment.id,
      title: `Seguimiento · ${shipment.code}`,
      description: shipmentContactLogAuditDescription(validated.data),
      metadata: {
        shipmentCode: shipment.code,
        customerName: shipment.customer_name,
        channel: validated.data.channel,
        channelOther: validated.data.channelOther,
        outcome: validated.data.outcome,
        nextStep: validated.data.nextStep,
        followUpAt: validated.data.followUpAt,
        source: "envios.contact_log",
      },
    });

    const updated = await listShipmentById(supabase, session, shipment.id);
    return updated ? ok(updated) : ok(shipment);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}


export async function finalizeShipmentInvoiceAction(input: {
  shipmentId: string;
  amount?: string;
  cost?: string;
  paymentMethod?: PaymentMethod;
  paymentNote?: string;
}): Promise<ActionResult<ShipmentRow>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "sales.manage")) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data: current, error: loadError } = await supabase
      .from("shipments")
      .select(SHIPMENT_SELECT)
      .eq("id", input.shipmentId)
      .eq("organization_id", session.organizationId)
      .single();

    if (loadError || !current) {
      return fail(loadError?.message || "Invoice no encontrado");
    }

    const shipment = mapShipment(current as unknown as ShipmentDbRow);
    const quote = readQuoteFromPlan(shipment.logistics_plan);
    const billing = readBillingFromPlan(shipment.logistics_plan);
    const cost = parseMoney(input.cost || quote?.cost || 0);
    const alreadyPaid = shipment.paid;
    const quotedTotal = billing
      ? parseMoney(billing.quotedTotal)
      : parseMoney(quote?.paid || "0");
    const balanceDue = Math.max(quotedTotal - alreadyPaid, 0);

    if (balanceDue <= 0) {
      return fail("No hay pendiente en este invoice");
    }

    const collectAmount =
      input.amount !== undefined && input.amount.trim() !== ""
        ? parseMoney(input.amount)
        : balanceDue;

    if (collectAmount <= 0) {
      return fail("El monto debe ser mayor a cero");
    }

    if (collectAmount > balanceDue) {
      return fail(`El monto no puede superar ${formatMoneyValue(balanceDue)}`);
    }

    const isFullPayment = collectAmount >= balanceDue;
    const paid = alreadyPaid + collectAmount;
    const paymentMethod = readPaymentMethod(input.paymentMethod);
    const paymentNote = cleanPaymentNote(input.paymentNote);
    const nextBalanceDue = Math.max(quotedTotal - paid, 0);
    const nextInvoiceStatus = isFullPayment ? "paid" : "open";
    const nextAccountingStatus = isFullPayment ? "exportable" : shipment.accounting_status;
    const nextFinalizedAt = isFullPayment ? new Date().toISOString() : shipment.finalized_at;
    const nextLogisticsPlan = {
      ...asRecord(shipment.logistics_plan),
      billing: billing
        ? {
            ...billing,
            payNow: formatMoneyValue(paid),
            balanceDue: formatMoneyValue(nextBalanceDue),
          }
        : {
            quotedTotal: formatMoneyValue(quotedTotal),
            payNow: formatMoneyValue(paid),
            balanceDue: formatMoneyValue(nextBalanceDue),
          },
    };

    const { error } = await supabase.rpc("collect_shipment_invoice_payment", {
      target_shipment_id: input.shipmentId,
      target_organization_id: session.organizationId,
      next_paid: paid,
      next_profit: isFullPayment ? Math.max(paid - cost, 0) : 0,
      next_sale_kind: shipment.sale_kind === "empty_box_deposit" ? "empty_box_deposit" : "full",
      next_invoice_status: nextInvoiceStatus,
      next_accounting_status: nextAccountingStatus,
      next_finalized_at: nextFinalizedAt,
      next_logistics_plan: nextLogisticsPlan,
      payment_amount: collectAmount,
      payment_method: paymentMethod,
      payment_kind: "balance",
      payment_note: paymentNote,
      payment_created_by: session.userId,
    });

    if (error) {
      return fail(error?.message || "No se pudo cobrar el invoice");
    }

    const updatedWithPayments = await listShipmentById(supabase, session, input.shipmentId);

    if (!updatedWithPayments) {
      return fail("No se pudo recargar el invoice");
    }

    await recordActivityHistory(supabase, session, {
      action: isFullPayment ? "sale.invoice_finalized" : "sale.invoice_partial_payment",
      entityType: "shipment",
      entityId: updatedWithPayments.id,
      title: isFullPayment
        ? `Invoice cobrado: ${updatedWithPayments.code}`
        : `Abono registrado: ${updatedWithPayments.code}`,
      description: isFullPayment
        ? `${updatedWithPayments.customer_name} · cobrado ${formatMoneyValue(collectAmount)} · ${paymentMethodLabel(paymentMethod)} · total ${formatMoneyValue(paid)}`
        : `${updatedWithPayments.customer_name} · abono ${formatMoneyValue(collectAmount)} · ${paymentMethodLabel(paymentMethod)} · pendiente ${formatMoneyValue(nextBalanceDue)}`,
      metadata: {
        paid,
        collectAmount,
        balanceDue: nextBalanceDue,
        quotedTotal,
        cost,
        profit: isFullPayment ? Math.max(paid - cost, 0) : 0,
        invoiceStatus: nextInvoiceStatus,
        accountingStatus: nextAccountingStatus,
        paymentMethod,
        paymentMethodLabel: paymentMethodLabel(paymentMethod),
        paymentNote,
      },
    });

    return ok(updatedWithPayments);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function updateShipmentInvoicePriorityAction(input: {
  shipmentId: string;
  priority: boolean;
}): Promise<ActionResult<ShipmentRow>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "sales.manage")) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const before = await listShipmentById(supabase, session, input.shipmentId);
    if (!before) {
      return fail("Invoice no encontrado");
    }

    if (before.invoice_priority === input.priority) {
      return ok(before);
    }

    const { data, error } = await supabase
      .from("shipments")
      .update({ invoice_priority: input.priority })
      .eq("id", input.shipmentId)
      .eq("organization_id", session.organizationId)
      .select(SHIPMENT_SELECT)
      .single();

    if (error || !data) {
      return fail(error?.message || "No se pudo actualizar prioridad");
    }

    const updated = mapShipment(data as unknown as ShipmentDbRow);

    await recordActivityHistory(supabase, session, {
      action: "sale.invoice_priority_updated",
      entityType: "shipment",
      entityId: updated.id,
      title: `Prioridad invoice: ${updated.code}`,
      description: input.priority ? "Marcado como prioridad" : "Prioridad removida",
      metadata: {
        shipmentCode: updated.code,
        previousPriority: before.invoice_priority,
        nextPriority: updated.invoice_priority,
      },
    });

    return ok(updated);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function updateShipmentSalesOwnerAction(input: {
  shipmentId: string;
  salesOwnerId: string;
}): Promise<ActionResult<ShipmentRow>> {
  try {
    const session = await requireAppSession();

    if (!canChangeShipmentSalesOwner(session)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data: owner, error: ownerError } = await supabase
      .from("profiles")
      .select("id, full_name, email, roles(slug)")
      .eq("id", input.salesOwnerId)
      .eq("organization_id", session.organizationId)
      .eq("is_active", true)
      .maybeSingle();

    if (ownerError) {
      return fail(ownerError.message);
    }

    const roleRow = owner?.roles as { slug: RoleSlug } | { slug: RoleSlug }[] | null | undefined;
    const role = Array.isArray(roleRow) ? roleRow[0] : roleRow;

    if (!owner || !isSalesOwnerRole(role?.slug)) {
      return fail("Vendedor no valido");
    }

    const before = await listShipmentById(supabase, session, input.shipmentId);

    await assertSameOrgProfileIds(supabase, session.organizationId, [input.salesOwnerId]);

    const { data, error } = await supabase
      .from("shipments")
      .update({ sales_owner_id: input.salesOwnerId })
      .eq("id", input.shipmentId)
      .eq("organization_id", session.organizationId)
      .select(SHIPMENT_SELECT)
      .single();

    if (error || !data) {
      return fail(error?.message || "No se pudo cambiar vendedor");
    }

    const updated = mapShipment(data as unknown as ShipmentDbRow);

    await recordActivityHistory(supabase, session, {
      action: "shipment.sales_owner_updated",
      entityType: "shipment",
      entityId: updated.id,
      title: `Vendedor · ${updated.code}`,
      description: `${before?.salesOwnerName || "Sin vendedor"} → ${updated.salesOwnerName}`,
      metadata: {
        shipmentCode: updated.code,
        previousSalesOwnerId: before?.salesOwnerId || null,
        nextSalesOwnerId: updated.salesOwnerId,
      },
    });

    return ok(updated);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

async function resolveTaskWarehouse(session: AppSession, warehouseId?: string | null) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error("Supabase service role no configurado");
  }

  if (warehouseId) {
    if (!canAccessWarehouse(session, warehouseId)) {
      throw new Error("No tienes acceso a esta bodega");
    }
    return { admin, warehouseId };
  }

  if (session.preferredWarehouseId && canAccessWarehouse(session, session.preferredWarehouseId)) {
    return { admin, warehouseId: session.preferredWarehouseId };
  }

  const { data: warehouse } = await admin
    .from("warehouses")
    .select("id")
    .eq("organization_id", session.organizationId)
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!warehouse?.id) {
    throw new Error("No hay bodega activa");
  }

  return { admin, warehouseId: warehouse.id as string };
}

function readEmptyBoxHandingNow(plan: Record<string, unknown>) {
  const emptyBox = asRecord(plan.emptyBox);
  return emptyBox.handingNow === true;
}

function emptyBoxStockAlreadyDeducted(plan: Record<string, unknown>) {
  const emptyBox = asRecord(plan.emptyBox);
  return Boolean(emptyBox.stockDeductedAt);
}

function shouldDeductCounterHandingStock(plan: Record<string, unknown>) {
  if (!readEmptyBoxHandingNow(plan) || emptyBoxStockAlreadyDeducted(plan)) {
    return false;
  }

  const emptyBox = asRecord(plan.emptyBox);
  return String(emptyBox.mode || "") === "Cliente recoge caja vacia en oficina";
}

async function deductEmptyBoxStock(input: {
  session: AppSession;
  shipment: ShipmentRow;
  warehouseId?: string | null;
  assigneeId?: string | null;
  movementNote: string;
}) {
  const plan = asRecord(input.shipment.logistics_plan);
  if (emptyBoxStockAlreadyDeducted(plan)) {
    throw new Error("El stock de caja vacia ya fue descontado para este envio");
  }

  const quoteLines = readQuoteLinesFromPlan(input.shipment.logistics_plan);
  if (!quoteLines.length) {
    throw new Error("Este invoice no tiene caja guardada en el plan logistico");
  }

  const { admin, warehouseId } = await resolveTaskWarehouse(
    input.session,
    input.warehouseId || null,
  );
  const { data: stockRows, error: stockError } = await admin
    .from("inventory_stock")
    .select("id, item_id, stock, inventory_items(id, name, kind)")
    .eq("warehouse_id", warehouseId)
    .eq("organization_id", input.session.organizationId);

  if (stockError) {
    throw new Error(stockError.message);
  }

  const deductions = quoteLines.map((quote) => {
    const normalizedBox = normalizeInventoryText(quote.label);
    const match = (stockRows || []).find((row) => {
      const itemRow = row.inventory_items as
        | { id: string; name: string; kind: string }
        | { id: string; name: string; kind: string }[]
        | null;
      const item = Array.isArray(itemRow) ? itemRow[0] : itemRow;
      if (!item) {
        return false;
      }

      return [item.kind, item.name, `Caja ${item.kind}`, `Caja ${item.name}`].some((value) => {
        const normalized = normalizeInventoryText(value || "");
        return normalized.includes(normalizedBox) || normalizedBox.includes(normalized);
      });
    });

    if (!match) {
      throw new Error(`No hay stock registrado para la caja ${quote.label}`);
    }

    if (Number(match.stock) < quote.quantity) {
      throw new Error(`Stock insuficiente para ${quote.label}`);
    }

    const itemRow = match.inventory_items as
      | { id: string; name: string; kind: string }
      | { id: string; name: string; kind: string }[];
    const item = Array.isArray(itemRow) ? itemRow[0] : itemRow;

    return { quote, match, item };
  });

  for (const deduction of deductions) {
    const { quote, item } = deduction;
    const qty = readPositiveIntegerQty(quote.quantity);

    await recordInventoryMovementAtomic(admin, {
      organizationId: input.session.organizationId,
      warehouseId,
      itemId: item.id,
      itemName: item.name || item.kind,
      type: "salida",
      qty,
      note: input.movementNote,
      createdBy: input.session.userId,
      assigneeId: input.assigneeId || input.session.userId,
    });
  }

  return { warehouseId, deductedAt: new Date().toISOString() };
}

async function deductEmptyBoxStockForTask(input: {
  session: AppSession;
  shipment: ShipmentRow;
  task: ShipmentLogisticsTaskRow;
  warehouseId?: string | null;
}) {
  if (input.task.taskType !== "deliver_empty_box" || input.task.stockDeductedAt) {
    return { warehouseId: input.task.warehouseId, deductedAt: input.task.stockDeductedAt };
  }

  return deductEmptyBoxStock({
    session: input.session,
    shipment: input.shipment,
    warehouseId: input.warehouseId || input.task.warehouseId,
    assigneeId: input.task.assignedTo || input.session.userId,
    movementNote: `Caja vacia cargada a ruta ${input.shipment.code}`,
  });
}

async function reverseInventorySalidasForShipment(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  session: AppSession,
  shipmentCode: string,
) {
  const { data: movements, error } = await admin
    .from("inventory_movements")
    .select("warehouse_id, item_id, item_name, qty")
    .eq("organization_id", session.organizationId)
    .eq("type", "salida")
    .ilike("note", `%${shipmentCode}%`);

  if (error) {
    throw new Error(error.message);
  }

  for (const movement of movements || []) {
    const qty = readPositiveIntegerQty(movement.qty);

    await recordInventoryMovementAtomic(admin, {
      organizationId: session.organizationId,
      warehouseId: movement.warehouse_id,
      itemId: movement.item_id,
      itemName: movement.item_name,
      type: "entrada",
      qty,
      note: `Reverso rollback envio ${shipmentCode}`,
      createdBy: session.userId,
    });
  }
}

async function deleteShipmentWithTasks(
  supabase: NonNullable<Awaited<ReturnType<typeof createScopedSupabase>>>,
  session: AppSession,
  shipmentId: string,
  shipmentCode?: string,
) {
  const admin = createSupabaseAdminClient();

  await supabase
    .from("shipment_payments")
    .delete()
    .eq("shipment_id", shipmentId)
    .eq("organization_id", session.organizationId);

  if (admin && shipmentCode) {
    await reverseInventorySalidasForShipment(admin, session, shipmentCode);
  }

  await supabase
    .from("shipment_logistics_tasks")
    .delete()
    .eq("shipment_id", shipmentId)
    .eq("organization_id", session.organizationId);
  await supabase
    .from("shipments")
    .delete()
    .eq("id", shipmentId)
    .eq("organization_id", session.organizationId);
}

export async function updateLogisticsTaskAction(input: {
  taskId: string;
  status?: LogisticsTaskStatus;
  assignedTo?: string | null;
  scheduledAt?: string | null;
  warehouseId?: string | null;
  notes?: string;
}): Promise<ActionResult<ShipmentLogisticsTaskRow>> {
  try {
    const session = await requireAppSession();

    if (!canManageRoutes(session)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data: taskData, error: taskError } = await supabase
      .from("shipment_logistics_tasks")
      .select("*")
      .eq("id", input.taskId)
      .eq("organization_id", session.organizationId)
      .single();

    if (taskError || !taskData) {
      return fail(taskError?.message || "Tarea no encontrada");
    }

    const task = mapTask(taskData as LogisticsTaskDbRow);

    const shipment = await listShipmentById(supabase, session, task.shipmentId);
    if (!shipment) {
      return fail("Invoice no encontrado");
    }

    if (input.assignedTo) {
      await assertSameOrgProfileIds(supabase, session.organizationId, [input.assignedTo]);
    }

    if (input.warehouseId) {
      await assertSameOrgWarehouseIds(supabase, session.organizationId, [input.warehouseId]);
    }

    const nextStatus = input.status || task.status;
    const nowIso = new Date().toISOString();
    const patch: Record<string, unknown> = {
      updated_at: nowIso,
    };

    if (input.status) {
      patch.status = nextStatus;
      patch.completed_at = nextStatus === "completed" ? nowIso : null;
      if (nextStatus === "assigned") {
        Object.assign(patch, logisticsTaskAssignedPatch(task, nowIso));
      }
    }

    if (input.assignedTo !== undefined) {
      patch.assigned_to = input.assignedTo || null;
      if (input.assignedTo && nextStatus === "pending") {
        patch.status = "assigned";
      }
      if (input.assignedTo) {
        Object.assign(patch, logisticsTaskAssignedPatch(task, nowIso));
      }
    }

    if (input.scheduledAt !== undefined) {
      Object.assign(patch, logisticsScheduleWindowPatch(input.scheduledAt));
      if (input.scheduledAt && nextStatus === "pending") {
        patch.status = "scheduled";
      }
    }

    if (input.warehouseId !== undefined) {
      if (task.stockDeductedAt && input.warehouseId !== task.warehouseId) {
        return fail("No puedes cambiar bodega despues de descontar stock");
      }
      patch.warehouse_id = input.warehouseId || null;
    }

    if (input.notes !== undefined) {
      patch.notes = input.notes;
    }

    if (nextStatus === "loaded_to_truck") {
      Object.assign(patch, logisticsTaskLoadedPatch(task, nowIso));
    }

    const stockDeductionNeeded =
      nextStatus === "loaded_to_truck" &&
      task.taskType === "deliver_empty_box" &&
      !task.stockDeductedAt;

    const { data, error } = await supabase
      .from("shipment_logistics_tasks")
      .update(patch)
      .eq("id", input.taskId)
      .eq("organization_id", session.organizationId)
      .select("*")
      .single();

    if (error || !data) {
      return fail(error?.message || "No se pudo actualizar la tarea");
    }

    let updated = mapTask(data as LogisticsTaskDbRow);

    if (stockDeductionNeeded) {
      try {
        const stockResult = await deductEmptyBoxStockForTask({
          session,
          shipment,
          task: {
            ...task,
            assignedTo: input.assignedTo !== undefined ? input.assignedTo : task.assignedTo,
            warehouseId: input.warehouseId !== undefined ? input.warehouseId : task.warehouseId,
          },
          warehouseId: input.warehouseId !== undefined ? input.warehouseId : task.warehouseId,
        });

        const { data: stockPatchData, error: stockPatchError } = await supabase
          .from("shipment_logistics_tasks")
          .update({
            warehouse_id: stockResult.warehouseId,
            stock_deducted_at: stockResult.deductedAt,
          })
          .eq("id", input.taskId)
          .eq("organization_id", session.organizationId)
          .select("*")
          .single();

        if (stockPatchError || !stockPatchData) {
          const rollbackAdmin = createSupabaseAdminClient();
          if (rollbackAdmin) {
            await reverseInventorySalidasForShipment(rollbackAdmin, session, shipment.code);
          }
          await supabase
            .from("shipment_logistics_tasks")
            .update({
              status: task.status,
              stock_deducted_at: task.stockDeductedAt,
              warehouse_id: task.warehouseId,
              loaded_at: task.loadedAt,
              updated_at: task.createdAt,
            })
            .eq("id", input.taskId)
            .eq("organization_id", session.organizationId);
          return fail(stockPatchError?.message || "No se pudo registrar descuento de stock");
        }

        updated = mapTask(stockPatchData as LogisticsTaskDbRow);
      } catch (stockError) {
        await supabase
          .from("shipment_logistics_tasks")
          .update({
            status: task.status,
            stock_deducted_at: task.stockDeductedAt,
            warehouse_id: task.warehouseId,
            loaded_at: task.loadedAt,
          })
          .eq("id", input.taskId)
          .eq("organization_id", session.organizationId);
        return fail(actionErrorMessage(stockError));
      }
    }

    if (input.assignedTo !== undefined) {
      await supabase
        .from("shipments")
        .update({ assigned_to: input.assignedTo || null })
        .eq("id", updated.shipmentId)
        .eq("organization_id", session.organizationId);
    }

    const actorName = session.fullName || session.email;

    if (
      input.scheduledAt !== undefined &&
      (task.scheduledAt || "") !== (input.scheduledAt || "")
    ) {
      const legKey = scheduleChangeFromTaskType(updated.taskType);
      const beforePlan = { ...(shipment.logistics_plan || {}) };
      const existingLeg = planLegRecord(beforePlan, legKey) || {};
      const beforeScheduleAt = String(existingLeg.scheduleAt || task.scheduledAt || "");
      const nextPlanScheduleAt = input.scheduledAt
        ? isoToPlanScheduleAt(input.scheduledAt, beforeScheduleAt)
        : "";

      const afterPlan = {
        ...beforePlan,
        [legKey]: {
          ...existingLeg,
          scheduleMode: nextPlanScheduleAt ? "scheduled" : "pending",
          scheduleAt: nextPlanScheduleAt || null,
        },
      };
      const enrichedPlan = applyScheduleChangeMetadata(beforePlan, afterPlan, actorName, nowIso);

      await supabase
        .from("shipments")
        .update({ logistics_plan: enrichedPlan })
        .eq("id", shipment.id)
        .eq("organization_id", session.organizationId);

      for (const change of detectLegScheduleChanges(beforePlan, enrichedPlan)) {
        await recordActivityHistory(supabase, session, {
          action: SHIPMENT_SCHEDULE_UPDATED_ACTION,
          entityType: "shipment",
          entityId: shipment.id,
          title: scheduleAuditTitle(shipment.code),
          description: describeScheduleAuditChange({
            beforeScheduleAt: change.beforeScheduleAt,
            afterScheduleAt: change.afterScheduleAt,
              stepTitle:
                change.taskType === "deliver_empty_box"
                  ? EMPTY_BOX_LEG_LABELS.auditStep
                  : FULL_BOX_LEG_LABELS.auditStep,
          }),
          metadata: scheduleAuditMetadata({
            shipmentCode: shipment.code,
            change,
            source: "logistica",
          }),
        });
      }
    }

    const milestoneKey =
      updated.status === "completed" ? milestoneKeyForLogisticsTask(updated.taskType) : null;

    if (milestoneKey && updated.completedAt) {
      await applyShipmentMilestonePatch(
        supabase,
        session,
        shipment,
        [{ key: milestoneKey, recordedAt: updated.completedAt }],
        "logistics_task",
        {
          taskId: updated.id,
          taskType: updated.taskType,
        },
      );
    }

    await recordActivityHistory(supabase, session, {
      action: "shipment.logistics_task_updated",
      entityType: "shipment",
      entityId: updated.shipmentId,
      title: `Tarea logistica: ${updated.status}`,
      description: `${shipment.code} · ${updated.taskType}`,
      metadata: {
        taskId: updated.id,
        taskType: updated.taskType,
        status: updated.status,
        assignedTo: updated.assignedTo,
        scheduledAt: updated.scheduledAt,
        warehouseId: updated.warehouseId,
        stockDeductedAt: updated.stockDeductedAt,
        orderedAt: updated.orderedAt,
        assignedAt: updated.assignedAt,
        loadedAt: updated.loadedAt,
        completedAt: updated.completedAt,
      },
    });

    return ok(updated);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function reactivateLogisticsTaskAction(input: {
  taskId: string;
  scheduledAt?: string | null;
  assignedTo?: string | null;
  warehouseId?: string | null;
  notes?: string;
}): Promise<ActionResult<ShipmentLogisticsTaskRow>> {
  try {
    const session = await requireAppSession();

    if (!canManageRoutes(session)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data: taskData, error: taskError } = await supabase
      .from("shipment_logistics_tasks")
      .select("*")
      .eq("id", input.taskId)
      .eq("organization_id", session.organizationId)
      .single();

    if (taskError || !taskData) {
      return fail(taskError?.message || "Tarea no encontrada");
    }

    const task = mapTask(taskData as LogisticsTaskDbRow);

    if (task.status !== "cancelled") {
      return fail("Solo puedes reprogramar tareas canceladas");
    }

    const shipment = await listShipmentById(supabase, session, task.shipmentId);
    if (!shipment) {
      return fail("Invoice no encontrado");
    }

    if (input.assignedTo) {
      await assertSameOrgProfileIds(supabase, session.organizationId, [input.assignedTo]);
    }

    if (input.warehouseId) {
      await assertSameOrgWarehouseIds(supabase, session.organizationId, [input.warehouseId]);
    }

    if (
      input.warehouseId !== undefined &&
      task.stockDeductedAt &&
      input.warehouseId !== task.warehouseId
    ) {
      return fail("No puedes cambiar bodega despues de descontar stock");
    }

    const nowIso = new Date().toISOString();
    const scheduledAt =
      input.scheduledAt !== undefined ? input.scheduledAt : task.scheduledAt;
    const assignedTo =
      input.assignedTo !== undefined ? input.assignedTo : task.assignedTo;
    const warehouseId =
      input.warehouseId !== undefined ? input.warehouseId : task.warehouseId;
    const notes = input.notes !== undefined ? input.notes : task.notes;

    const nextStatus = scheduledAt
      ? "scheduled"
      : assignedTo
        ? "assigned"
        : "pending";

    const patch: Record<string, unknown> = {
      status: nextStatus,
      ...logisticsScheduleWindowPatch(scheduledAt),
      assigned_to: assignedTo || null,
      warehouse_id: warehouseId || null,
      notes,
      updated_at: nowIso,
      ...logisticsTaskReactivatePatchPreservingStock(task, nowIso),
    };

    if (assignedTo) {
      Object.assign(patch, logisticsTaskAssignedPatch(task, nowIso));
    }

    const { data, error } = await supabase
      .from("shipment_logistics_tasks")
      .update(patch)
      .eq("id", input.taskId)
      .eq("organization_id", session.organizationId)
      .select("*")
      .single();

    if (error || !data) {
      return fail(error?.message || "No se pudo reprogramar la tarea");
    }

    const updated = mapTask(data as LogisticsTaskDbRow);

    if (input.assignedTo !== undefined) {
      await supabase
        .from("shipments")
        .update({ assigned_to: input.assignedTo || null })
        .eq("id", updated.shipmentId)
        .eq("organization_id", session.organizationId);
    }

    await recordActivityHistory(supabase, session, {
      action: "shipment.logistics_task_reactivated",
      entityType: "shipment",
      entityId: updated.shipmentId,
      title: `Tarea reprogramada: ${shipment.code}`,
      description: `${updated.taskType} · ${nextStatus}`,
      metadata: {
        taskId: updated.id,
        taskType: updated.taskType,
        status: updated.status,
        assignedTo: updated.assignedTo,
        scheduledAt: updated.scheduledAt,
        warehouseId: updated.warehouseId,
        stockDeductedAt: updated.stockDeductedAt,
        source: "logistica",
      },
    });

    return ok(updated);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function updateShipmentLogisticsPlanAction(
  input: UpdateShipmentLogisticsPlanInput & {
    shipmentId: string;
    audit?: ShipmentAuditContext;
  },
): Promise<ActionResult<ShipmentRow>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "sales.manage")) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const shipment = await listShipmentById(supabase, session, input.shipmentId);
    if (!shipment) {
      return fail("Invoice no encontrado");
    }

    const validationError = validateLogisticsPlanUpdate(shipment, input);
    if (validationError) {
      return fail(validationError);
    }

    const persisted = await persistShipmentLogisticsPlanUpdate(
      supabase,
      session,
      shipment,
      input,
      input.audit,
    );

    return persisted.ok ? ok(persisted.shipment) : fail(persisted.error);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function markFullBoxReceivedAtOfficeAction(input: {
  shipmentId: string;
  audit?: ShipmentAuditContext;
}): Promise<ActionResult<ShipmentRow>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "sales.manage")) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const shipment = await listShipmentById(supabase, session, input.shipmentId);
    if (!shipment) {
      return fail("Invoice no encontrado");
    }

    if (shipment.sale_kind === "empty_box_deposit") {
      return fail("Este invoice es solo depósito de caja vacía.");
    }

    if (!shipment.empty_box_delivered_at) {
      return fail("Primero registra la entrega de la caja vacía.");
    }

    if (shipment.full_box_collected_at) {
      return ok(shipment);
    }

    const emptyBox = asRecord(shipment.logistics_plan.emptyBox);
    const persisted = await persistShipmentLogisticsPlanUpdate(
      supabase,
      session,
      shipment,
      {
        emptyBox: {
          mode: String(emptyBox.mode || ""),
          handingNow: emptyBox.handingNow === true,
          scheduleMode: String(emptyBox.scheduleMode || "pending"),
          scheduleAt: String(emptyBox.scheduleAt || "") || null,
          driverTaskOrdered: emptyBox.driverTaskOrdered === true,
        },
        fullBox: {
          mode: FULL_BOX_OFFICE_MODE,
          scheduleMode: "pending",
          scheduleAt: null,
          driverTaskOrdered: false,
        },
      },
      input.audit,
    );

    if (!persisted.ok) {
      return fail(persisted.error);
    }

    const now = new Date().toISOString();
    const beforeMilestones = readShipmentMilestones(persisted.shipment);
    const milestonePatch = buildFirstMilestonePatch(beforeMilestones, [
      { key: "full_box_collected_at", recordedAt: now },
      { key: "office_received_at", recordedAt: now },
    ]);
    const { data, error } = await supabase
      .from("shipments")
      .update({ status: "En oficina", ...milestonePatch })
      .eq("id", persisted.shipment.id)
      .eq("organization_id", session.organizationId)
      .select(SHIPMENT_SELECT)
      .single();

    if (error || !data) {
      return fail(error?.message || "No se pudo registrar la caja en oficina");
    }

    const updated = mapShipment(data as unknown as ShipmentDbRow);
    await recordActivityHistory(supabase, session, {
      action: "shipment.status_updated",
      entityType: "shipment",
      entityId: updated.id,
      title: `Caja llena recibida en oficina · ${updated.code}`,
      description: "El cliente entregó la caja llena en oficina.",
      metadata: {
        shipmentCode: updated.code,
        previousStatus: shipment.status,
        nextStatus: "En oficina",
        source: input.audit?.source || "envios.progress",
        interaction: input.audit?.interaction || "context_menu",
        stepTitle: input.audit?.stepTitle || null,
        stepKind: input.audit?.stepKind || "full_box",
        customerName: updated.customer_name,
        country: updated.country,
      },
    });

    await recordShipmentMilestoneAudits(
      supabase,
      session,
      updated,
      newlyRecordedMilestones(beforeMilestones, milestonePatch),
      "status_update",
      {
        previousStatus: shipment.status,
        nextStatus: "En oficina",
        audit: input.audit,
      },
    );

    return ok(updated);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function updateShipmentStatusAction(
  shipmentId: string,
  status: ShipmentStatus,
  audit?: ShipmentAuditContext,
): Promise<ActionResult<ShipmentRow>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "routes.update_status")) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const current = await listShipmentById(supabase, session, shipmentId);
    if (!current) {
      return fail("Envio no encontrado");
    }

    if (current.status === status) {
      return ok(current);
    }

    if (isPendingShipmentStatus(status)) {
      return fail("Este estado se asigna automáticamente según la logística");
    }

    const now = new Date().toISOString();
    const milestoneEntries: Array<{ key: ShipmentMilestoneKey; recordedAt: string }> = [];

    const statusMilestone = milestoneKeyForStatus(status);
    if (statusMilestone) {
      milestoneEntries.push({ key: statusMilestone, recordedAt: now });
    }

    const fullBoxOfficeMode =
      String(asRecord(current.logistics_plan.fullBox).mode || "") ===
      "Cliente trae caja llena a oficina";

    if (status === "En oficina" && fullBoxOfficeMode) {
      milestoneEntries.push({ key: "full_box_collected_at", recordedAt: now });
    }

    const beforeMilestones = readShipmentMilestones(current);
    const milestonePatch = buildFirstMilestonePatch(beforeMilestones, milestoneEntries);

    let query = supabase
      .from("shipments")
      .update({ status, ...milestonePatch })
      .eq("id", shipmentId)
      .eq("organization_id", session.organizationId);

    if (session.roleSlug === "conductor") {
      query = query.eq("assigned_to", session.userId);
    }

    const { data, error } = await query.select(SHIPMENT_SELECT).single();

    if (error || !data) {
      return fail(error?.message || "Envio no encontrado");
    }

    const row = mapShipment(data as unknown as ShipmentDbRow);

    await recordActivityHistory(supabase, session, {
      action: "shipment.status_updated",
      entityType: "shipment",
      entityId: row.id,
      title: `Estado · ${row.code}`,
      description: audit
        ? describeStatusAuditChange({
            previousStatus: current.status,
            nextStatus: status,
            interaction: audit.interaction,
            stepTitle: audit.stepTitle,
          })
        : `${current.status} → ${status}`,
      metadata: {
        shipmentCode: row.code,
        previousStatus: current.status,
        nextStatus: status,
        source: audit?.source || "envios",
        interaction: audit?.interaction || null,
        stepTitle: audit?.stepTitle || null,
        stepKind: audit?.stepKind || null,
        customerName: row.customer_name,
        country: row.country,
      },
    });

    const recordedMilestones = newlyRecordedMilestones(beforeMilestones, milestonePatch);
    if (recordedMilestones.length) {
      await recordShipmentMilestoneAudits(supabase, session, row, recordedMilestones, "status_update", {
        previousStatus: current.status,
        nextStatus: status,
        audit,
      });
    }

    return ok(row);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
