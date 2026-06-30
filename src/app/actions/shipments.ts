"use server";

import { requireAppSession } from "@/lib/auth/session";
import { canAccessWarehouse, sessionHasPermission } from "@/lib/auth/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import { recordActivityHistory } from "@/lib/activity-history";
import { scheduleAtToTimestamp } from "@/components/sale/schedule-time";
import { readBillingFromPlan } from "@/lib/invoice-billing";
import { formatMoneyValue } from "@/lib/logistics-fees";
import { isAssignableRouteMemberRole } from "@/lib/route-members";
import {
  describeLogisticsAuditChange,
  describeStatusAuditChange,
  logisticsLegSnapshot,
  type ShipmentAuditContext,
} from "@/lib/shipment-audit";
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
import type { AppSession, RoleSlug } from "@/lib/auth/types";

export type ShipmentStatus =
  | "Pendiente"
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

export type ShipmentLogisticsTaskRow = {
  id: string;
  shipmentId: string;
  taskType: LogisticsTaskType;
  status: LogisticsTaskStatus;
  assignedTo: string | null;
  scheduledAt: string | null;
  warehouseId: string | null;
  notes: string;
  stockDeductedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type ShipmentRow = {
  id: string;
  code: string;
  customerId: string | null;
  recipientId: string | null;
  recipientSnapshot: Record<string, unknown> | null;
  customer_name: string;
  country: string;
  carrier: string;
  paid: number;
  profit: number;
  status: ShipmentStatus;
  assigned_to: string | null;
  sale_kind: ShipmentSaleKind;
  invoice_status: InvoiceStatus;
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
  logisticsTasks: ShipmentLogisticsTaskRow[];
};

export type RouteMemberRow = {
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
  warehouse_id: string | null;
  notes: string | null;
  stock_deducted_at: string | null;
  completed_at: string | null;
  created_at: string;
};

type ShipmentDbRow = {
  id: string;
  code: string;
  customer_id?: string | null;
  recipient_id?: string | null;
  recipient_snapshot?: Record<string, unknown> | null;
  customer_name: string;
  country: string;
  carrier: string;
  paid: number;
  profit: number;
  status: ShipmentStatus;
  assigned_to: string | null;
  sale_kind?: ShipmentSaleKind | null;
  invoice_status?: InvoiceStatus | null;
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
};

type ShipmentQuote = {
  label: string;
  paid: string;
  cost: string;
  quantity: number;
};

const SHIPMENT_SELECT = `
  id, code, customer_id, recipient_id, recipient_snapshot, customer_name, country, carrier, paid, profit, status, assigned_to,
  sale_kind, invoice_status, accounting_status, created_at, finalized_at,
  empty_box_delivered_at, full_box_collected_at, office_received_at, departed_at, shipped_at, delivered_at,
  delivery_notes, logistics_plan,
  shipment_logistics_tasks (
    id, shipment_id, task_type, status, assigned_to, scheduled_at, warehouse_id,
    notes, stock_deducted_at, completed_at, created_at
  )
`;

function parseMoney(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  return Number(String(value || "").replace(/[^\d.-]/g, "")) || 0;
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
      label: lines.map((line) => `${line.label} x${line.quantity}`).join(" + "),
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
    warehouseId: row.warehouse_id,
    notes: row.notes || "",
    stockDeductedAt: row.stock_deducted_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

function mapShipment(row: ShipmentDbRow): ShipmentRow {
  const tasks = (row.shipment_logistics_tasks || [])
    .map(mapTask)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return {
    id: row.id,
    code: row.code,
    customerId: row.customer_id || null,
    recipientId: row.recipient_id || null,
    recipientSnapshot: row.recipient_snapshot || null,
    customer_name: row.customer_name,
    country: row.country,
    carrier: row.carrier,
    paid: Number(row.paid) || 0,
    profit: Number(row.profit) || 0,
    status: row.status,
    assigned_to: row.assigned_to,
    sale_kind: row.sale_kind || "full",
    invoice_status: row.invoice_status || (row.sale_kind === "empty_box_deposit" ? "open" : "paid"),
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
    logisticsTasks: tasks,
  };
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

  return updated;
}

function canManageRoutes(session: AppSession) {
  return (
    sessionHasPermission(session, "routes.update_status") ||
    sessionHasPermission(session, "sales.manage")
  );
}

export async function listShipmentsAction(): Promise<ActionResult<ShipmentRow[]>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "routes.view")) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    let query = supabase
      .from("shipments")
      .select(SHIPMENT_SELECT)
      .eq("organization_id", session.organizationId)
      .order("created_at", { ascending: false });

    if (session.roleSlug === "conductor") {
      query = query.eq("assigned_to", session.userId);
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === "42P01" || error.code === "42703") {
        return ok([]);
      }
      return fail(error.message);
    }

    return ok(((data || []) as unknown as ShipmentDbRow[]).map(mapShipment));
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

    const paid = parseMoney(input.paid);
    const cost = parseMoney(input.cost);
    const saleKind = input.saleKind || (input.recipientId ? "full" : "empty_box_deposit");
    const country = input.country || "USA";
    const deliveryNotes = input.deliveryNotes || "";
    const invoiceStatus = input.invoiceStatus || "paid";
    const accountingStatus =
      input.accountingStatus || (invoiceStatus === "paid" ? "exportable" : "not_exportable");

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
        status: "Pendiente",
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

    const shipment = mapShipment(data as unknown as ShipmentDbRow);
    const logisticsTasks = input.logisticsTasks || [];
    const logisticsPlan = { ...(input.logisticsPlan || {}) };

    if (logisticsTasks.length) {
      const { error: taskError } = await supabase.from("shipment_logistics_tasks").insert(
        logisticsTasks.map((task) => ({
          organization_id: session.organizationId,
          shipment_id: shipment.id,
          task_type: task.taskType,
          status: task.status || (task.scheduledAt ? "scheduled" : "pending"),
          scheduled_at: scheduleAtToTimestamp(task.scheduledAt),
          warehouse_id: task.warehouseId || null,
          notes: task.notes || "",
        })),
      );

      if (taskError) {
        await deleteShipmentWithTasks(supabase, session, shipment.id);
        return fail(taskError.message);
      }
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
      } catch (stockError) {
        await deleteShipmentWithTasks(supabase, session, shipment.id);
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
        logisticsPlan: shipment.logistics_plan,
      },
    });

    if (!logisticsTasks.length) {
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

export async function finalizeShipmentInvoiceAction(input: {
  shipmentId: string;
  paid?: string;
  cost?: string;
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
    const balanceDue = billing
      ? parseMoney(billing.balanceDue)
      : Math.max(parseMoney(quote?.paid || "0") - alreadyPaid, 0);
    const quotedTotal = billing
      ? parseMoney(billing.quotedTotal)
      : parseMoney(quote?.paid || "0");

    if (balanceDue <= 0) {
      return fail("No hay pendiente en este invoice");
    }

    const paid = alreadyPaid + balanceDue;

    if (paid <= 0) {
      return fail("No hay monto para cobrar en este invoice");
    }

    const { data, error } = await supabase
      .from("shipments")
      .update({
        paid,
        profit: Math.max(paid - cost, 0),
        sale_kind: shipment.sale_kind === "empty_box_deposit" ? "empty_box_deposit" : "full",
        invoice_status: "paid",
        accounting_status: "exportable",
        finalized_at: new Date().toISOString(),
        logistics_plan: {
          ...asRecord(shipment.logistics_plan),
          billing: billing
            ? {
                ...billing,
                payNow: billing.quotedTotal,
                balanceDue: "$0",
              }
            : {
                quotedTotal: formatMoneyValue(quotedTotal),
                payNow: formatMoneyValue(paid),
                balanceDue: "$0",
              },
        },
      })
      .eq("id", input.shipmentId)
      .eq("organization_id", session.organizationId)
      .select(SHIPMENT_SELECT)
      .single();

    if (error || !data) {
      return fail(error?.message || "No se pudo cobrar el invoice");
    }

    const updated = mapShipment(data as unknown as ShipmentDbRow);

    await recordActivityHistory(supabase, session, {
      action: "sale.invoice_finalized",
      entityType: "shipment",
      entityId: updated.id,
      title: `Invoice cobrado: ${updated.code}`,
      description: `${updated.customer_name} · pendiente $${balanceDue.toFixed(2)} · total $${paid.toFixed(2)}`,
      metadata: {
        paid,
        balanceDue,
        quotedTotal,
        cost,
        profit: Math.max(paid - cost, 0),
        invoiceStatus: "paid",
        accountingStatus: "exportable",
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
    const { quote, match, item } = deduction;
    const { error: updateError } = await admin
      .from("inventory_stock")
      .update({ stock: Number(match.stock) - quote.quantity })
      .eq("id", match.id)
      .eq("organization_id", input.session.organizationId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    const { error: movementError } = await admin.from("inventory_movements").insert({
      organization_id: input.session.organizationId,
      warehouse_id: warehouseId,
      item_id: item.id,
      item_name: item.name || item.kind,
      type: "salida",
      qty: quote.quantity,
      note: input.movementNote,
      created_by: input.session.userId,
      assignee_id: input.assigneeId || input.session.userId,
    });

    if (movementError) {
      throw new Error(movementError.message);
    }
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

async function deleteShipmentWithTasks(
  supabase: NonNullable<Awaited<ReturnType<typeof createScopedSupabase>>>,
  session: AppSession,
  shipmentId: string,
) {
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

    const nextStatus = input.status || task.status;
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.status) {
      patch.status = nextStatus;
      patch.completed_at = nextStatus === "completed" ? new Date().toISOString() : null;
    }

    if (input.assignedTo !== undefined) {
      patch.assigned_to = input.assignedTo || null;
      if (input.assignedTo && nextStatus === "pending") {
        patch.status = "assigned";
      }
    }

    if (input.scheduledAt !== undefined) {
      patch.scheduled_at = input.scheduledAt || null;
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

    if (nextStatus === "loaded_to_truck" && task.taskType === "deliver_empty_box" && !task.stockDeductedAt) {
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

      patch.warehouse_id = stockResult.warehouseId;
      patch.stock_deducted_at = stockResult.deductedAt;
    }

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

    const updated = mapTask(data as LogisticsTaskDbRow);

    if (input.assignedTo !== undefined) {
      await supabase
        .from("shipments")
        .update({ assigned_to: input.assignedTo || null })
        .eq("id", updated.shipmentId)
        .eq("organization_id", session.organizationId);
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

    const beforePlan = { ...(shipment.logistics_plan || {}) };
    const { logisticsPlan, deliveryNotes } = buildUpdatedLogisticsPlan(shipment, input);
    const taskSync = logisticsTaskSyncPlan(shipment, input);

    for (const spec of taskSync) {
      if (!spec.existing) {
        if (spec.needed) {
          const { error } = await supabase.from("shipment_logistics_tasks").insert({
            organization_id: session.organizationId,
            shipment_id: shipment.id,
            task_type: spec.taskType,
            status: spec.scheduleMode === "scheduled" && spec.scheduleAt ? "scheduled" : "pending",
            scheduled_at: scheduleAtToTimestamp(spec.scheduleAt),
            notes: String(shipment.logistics_plan?.notes || ""),
          });

          if (error) {
            return fail(error.message);
          }
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
            })
            .eq("id", spec.existing.id)
            .eq("organization_id", session.organizationId);

          if (error) {
            return fail(error.message);
          }
        }

        continue;
      }

      if (spec.existing.status === "completed") {
        continue;
      }

      const nextStatus =
        spec.scheduleMode === "scheduled" && spec.scheduleAt ? "scheduled" : "pending";

      const { error } = await supabase
        .from("shipment_logistics_tasks")
        .update({
          status: nextStatus,
          scheduled_at: scheduleAtToTimestamp(spec.scheduleAt),
          updated_at: new Date().toISOString(),
        })
        .eq("id", spec.existing.id)
        .eq("organization_id", session.organizationId);

      if (error) {
        return fail(error.message);
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
      return fail(updateError.message);
    }

    await recordActivityHistory(supabase, session, {
      action: "shipment.logistics_plan_updated",
      entityType: "shipment",
      entityId: shipment.id,
      title: `Logística · ${shipment.code}`,
      description: input.audit
        ? describeLogisticsAuditChange({
            before: beforePlan,
            after: logisticsPlan,
            interaction: input.audit.interaction,
            stepTitle: input.audit.stepTitle,
          })
        : deliveryNotes,
      metadata: {
        shipmentCode: shipment.code,
        source: input.audit?.source || "envios",
        interaction: input.audit?.interaction || null,
        stepTitle: input.audit?.stepTitle || null,
        stepKind: input.audit?.stepKind || null,
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

    const reloaded = await listShipmentById(supabase, session, shipment.id);
    return reloaded ? ok(reloaded) : fail("No se pudo recargar el envío");
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
