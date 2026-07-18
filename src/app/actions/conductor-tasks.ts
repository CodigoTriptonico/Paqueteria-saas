"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  listLogisticsRoutesAction,
  listLogisticsTaskAddressesAction,
  tryAutoCompleteLogisticsRoute,
} from "@/app/actions/logistics-routes";
import { listLogisticsVehiclesAction } from "@/app/actions/logistics-fleet";
import { vehicleDisplayLabel } from "@/lib/logistics-route-vehicle";
import {
  listShipmentsForRouteBoardAction,
  type ShipmentRow,
} from "@/app/actions/shipments";
import {
  canPreviewConductorTasks,
  conductorAdminAuditMetadata,
  formatConductorAdminActionNote,
  formatConductorAdminActorDescription,
} from "@/lib/conductor-tareas-view";
import {
  buildConductorDriverTasks,
  buildRouteByTaskId,
  conductorScopeDate,
  conductorTaskTypeLabel,
  isConductorClosedTaskInScope,
  isTaskAssignedToDriver,
  scheduledAtScopeDate,
  type ConductorDriverTask,
} from "@/lib/conductor-tasks";
import {
  buildConductorTruckInventory,
  buildConductorTruckInventoryScope,
  buildConductorTruckBalance,
  buildConductorFullBoxCargo,
  conductorTruckLoadTasks,
  conductorTruckLineKey,
  conductorTruckStockCatalogKey,
  hasDeliverEventForTaskLine,
  hasPickupReturnEventForTaskLine,
  LOGISTICS_TASK_EVIDENCE_BUCKET,
  validateConductorTruckDeliver,
  validateConductorTruckLoad,
  validateConductorTruckReturn,
  validateConductorTruckReturnInput,
  validateConductorTaskResultInput,
  isConductorTruckVehicleChangeReason,
  type ConductorTransferVehicleOption,
  type ConductorTaskFailureReason,
  type ConductorTruckInventoryEvent,
  type ConductorTruckInventoryLine,
  type ConductorTruckInventoryScope,
  type ConductorTruckInventorySummary,
  type ConductorTruckBalance,
  type ConductorFullBoxCargoSummary,
  type ConductorTruckStockItem,
} from "@/lib/conductor-truck-inventory";
import { requireAppSession } from "@/lib/auth/session";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import { recordActivityHistory } from "@/lib/activity-history";
import { recordInventoryMovementAtomic } from "@/lib/security/inventory-movement";
import { readPositiveIntegerQty } from "@/lib/security/qty";
import { formatMoneyValue, parseMoneyValue } from "@/lib/logistics-fees";
import { readBillingFromPlan } from "@/lib/invoice-billing";
import {
  conductorCollectionAuditDescription,
  conductorPaymentChoiceError,
  isConductorPaymentChoice,
  resolveConductorPaymentAmount,
  settleConductorPayment,
  type ConductorPaymentOutcome,
} from "@/lib/conductor-driver-payment";
import {
  DEFAULT_PAYMENT_METHOD,
  isPaymentMethod,
  paymentMethodLabel,
  type PaymentMethod,
} from "@/lib/payment-methods";
import { quoteFromShipment, syncShipmentStatusPatch } from "@/lib/shipment-display";
import { physicalPackageCodesForShipment } from "@/lib/physical-packages";
import { invoiceBoxCode } from "@/lib/invoice-child-codes";
import {
  buildFirstMilestonePatch,
  milestoneKeyForLogisticsTask,
  readShipmentMilestones,
} from "@/lib/shipment-milestones";
import { logisticsScheduleWindowPatch } from "@/lib/logistics-schedule-window";
import {
  logisticsTaskAssignedPatch,
  logisticsTaskReactivatePatchPreservingStock,
} from "@/lib/shipment-logistics-task-timestamps";
import type { AppSession } from "@/lib/auth/types";

type Supabase = NonNullable<Awaited<ReturnType<typeof createScopedSupabase>>>;
type Admin = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

type TruckEventDbRow = {
  id: string;
  event_type: ConductorTruckInventoryEvent["eventType"];
  route_id: string | null;
  task_id: string | null;
  shipment_id: string | null;
  warehouse_id: string | null;
  item_id: string | null;
  item_name: string | null;
  catalog_key: string | null;
  item_label: string | null;
  qty: number | string;
  created_at: string;
};

type StockDbRow = {
  item_id: string;
  warehouse_id: string;
  stock: number | string;
  inventory_items:
    | {
        name?: string | null;
        kind?: string | null;
        subcategory?: string | null;
        inventory_categories?: { name?: string | null } | { name?: string | null }[] | null;
      }
    | {
        name?: string | null;
        kind?: string | null;
        subcategory?: string | null;
        inventory_categories?: { name?: string | null } | { name?: string | null }[] | null;
      }[]
  | null;
};

type ConductorProfileDbRow = {
  id: string;
  email: string;
  full_name: string | null;
  roles:
    | { slug?: string | null }
    | { slug?: string | null }[]
    | null;
};

export type ConductorTruckInventoryView = {
  driverId: string;
  selectedRouteId: string | null;
  routes: Array<{
    id: string;
    name: string;
    routeDate: string;
    status: "draft" | "planned" | "in_progress" | "cancelled" | "completed";
    vehicleId: string | null;
    stopCount: number;
  }>;
  scope: ConductorTruckInventoryScope;
  summary: ConductorTruckInventorySummary;
  stock: ConductorTruckStockItem[];
  cargo: ConductorFullBoxCargoSummary;
  currentVehicleId: string | null;
  transferVehicles: ConductorTransferVehicleOption[];
};

export type ConductorHomeVehicleStatus = {
  routeName: string | null;
  routeStatus: ConductorTruckInventoryView["routes"][number]["status"] | null;
  vehicleLabel: string | null;
  status: "no_route" | "unassigned" | "inactive" | "active";
};

type DriverTaskDbRow = {
  id: string;
  shipment_id: string;
  task_type: ConductorDriverTask["taskType"];
  status: ConductorDriverTask["status"];
  assigned_to: string | null;
  scheduled_at: string | null;
  warehouse_id: string | null;
  created_at: string;
  stock_deducted_at?: string | null;
  loaded_at?: string | null;
  notes?: string | null;
};

const EVIDENCE_MAX_BYTES = 8 * 1024 * 1024;
const EVIDENCE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function conductorActionAudit(session: AppSession, driverId: string) {
  return {
    roleSlug: session.roleSlug,
    actorUserId: session.userId,
    actorName: session.fullName || session.email,
    effectiveDriverId: driverId,
  };
}

function conductorActionAuditMetadata(session: AppSession, driverId: string) {
  return conductorAdminAuditMetadata(conductorActionAudit(session, driverId));
}

function cleanText(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max);
}

function readPaymentMethod(value: unknown): PaymentMethod {
  const normalized = String(value || DEFAULT_PAYMENT_METHOD).trim();
  return isPaymentMethod(normalized) ? normalized : DEFAULT_PAYMENT_METHOD;
}

function unwrapJoin<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] ?? null : value;
}

function mapTruckEvent(row: TruckEventDbRow): ConductorTruckInventoryEvent {
  return {
    id: row.id,
    eventType: row.event_type,
    routeId: row.route_id,
    taskId: row.task_id,
    shipmentId: row.shipment_id,
    warehouseId: row.warehouse_id,
    itemId: row.item_id,
    itemName: row.item_name || "",
    catalogKey: row.catalog_key || "",
    itemLabel: row.item_label || row.item_name || "",
    qty: Number(row.qty) || 0,
    createdAt: row.created_at,
  };
}

function mapStock(row: StockDbRow): ConductorTruckStockItem | null {
  const item = unwrapJoin(row.inventory_items);
  const category = unwrapJoin(item?.inventory_categories);

  if (!item) {
    return null;
  }

  return {
    itemId: row.item_id,
    itemName: item.name || item.kind || "Caja",
    category: category?.name || "",
    kind: item.kind || item.name || "",
    subcategory: item.subcategory || undefined,
    warehouseId: row.warehouse_id,
    stock: Number(row.stock) || 0,
  };
}

function canWriteDriverTask(session: AppSession) {
  return sessionHasPermission(session, "routes.update_status");
}

function resolveDriverId(session: AppSession, requestedDriverId?: string | null) {
  const requested = cleanText(requestedDriverId, 80);

  if (canPreviewConductorTasks(session.roleSlug)) {
    return requested || session.userId;
  }

  return session.userId;
}

function resolveConductorActionDriverId(session: AppSession, requestedDriverId?: string | null) {
  const effectiveDriverId = resolveDriverId(session, requestedDriverId);

  if (!effectiveDriverId) {
    throw new Error("Falta conductor");
  }

  if (!canPreviewConductorTasks(session.roleSlug) && session.userId !== effectiveDriverId) {
    throw new Error("FORBIDDEN");
  }

  return effectiveDriverId;
}

async function loadConductorData(driverId: string, scopeDate?: string) {
  const effectiveScopeDate = scopeDate ?? conductorScopeDate();
  const [shipmentsResult, routesResult, addressesResult, vehiclesResult] = await Promise.all([
    listShipmentsForRouteBoardAction(),
    listLogisticsRoutesAction(),
    listLogisticsTaskAddressesAction(),
    listLogisticsVehiclesAction(),
  ]);

  if (!shipmentsResult.ok) {
    throw new Error(shipmentsResult.error);
  }

  if (!routesResult.ok) {
    throw new Error(routesResult.error);
  }

  if (!addressesResult.ok) {
    throw new Error(addressesResult.error);
  }

  return {
    shipments: shipmentsResult.data,
    routes: routesResult.data,
    taskAddresses: addressesResult.data,
    vehicles: vehiclesResult.ok ? vehiclesResult.data : [],
    tasks: buildConductorDriverTasks({
      shipments: shipmentsResult.data,
      routes: routesResult.data,
      taskAddresses: addressesResult.data,
      vehicles: vehiclesResult.ok ? vehiclesResult.data : [],
      driverId,
      scopeDate: effectiveScopeDate,
      visibility: "open",
    }),
    scopeDate: effectiveScopeDate,
  };
}

async function loadDriverTaskFromDb(admin: Admin, session: AppSession, taskId: string) {
  const { data, error } = await admin
    .from("shipment_logistics_tasks")
    .select(
      "id, shipment_id, task_type, status, assigned_to, scheduled_at, warehouse_id, created_at, stock_deducted_at, loaded_at, notes",
    )
    .eq("id", taskId)
    .eq("organization_id", session.organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as DriverTaskDbRow | null) ?? null;
}

async function loadTruckEvents(
  supabase: Supabase,
  session: AppSession,
  vehicleId: string | null,
) {
  if (!vehicleId) {
    return [];
  }

  const { data, error } = await supabase
    .from("logistics_truck_inventory_events")
    .select(
      "id, event_type, route_id, task_id, shipment_id, warehouse_id, item_id, item_name, catalog_key, item_label, qty, created_at",
    )
    .eq("organization_id", session.organizationId)
    .eq("vehicle_id", vehicleId)
    .order("created_at", { ascending: true });

  if (error) {
    if (error.code === "42P01") {
      return [];
    }
    throw new Error(error.message);
  }

  return ((data || []) as TruckEventDbRow[]).map(mapTruckEvent);
}

async function loadTruckStock(admin: Admin, session: AppSession) {
  const { data, error } = await admin
    .from("inventory_stock")
    .select(
      "item_id, warehouse_id, stock, inventory_items(name, kind, subcategory, inventory_categories(name))",
    )
    .eq("organization_id", session.organizationId);

  if (error) {
    throw new Error(error.message);
  }

  return ((data || []) as StockDbRow[]).map(mapStock).filter((row): row is ConductorTruckStockItem => Boolean(row));
}

async function loadConductorTransferVehicles(
  admin: Admin,
  session: AppSession,
  currentVehicleId: string | null,
): Promise<ConductorTransferVehicleOption[]> {
  const { data, error } = await admin
    .from("logistics_vehicles")
    .select("id, name, plate, is_active")
    .eq("organization_id", session.organizationId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data || [])
    .filter((vehicle) => vehicle.id !== currentVehicleId)
    .map((vehicle) => ({
      id: vehicle.id,
      label: vehicleDisplayLabel(vehicle) || vehicle.name,
    }));
}

async function loadTruckInventoryView(
  session: AppSession,
  driverId: string,
  routeId?: string | null,
  scopeDate = conductorScopeDate(),
): Promise<ConductorTruckInventoryView> {
  const supabase = await createScopedSupabase(session);
  const admin = createSupabaseAdminClient();

  if (!supabase || !admin) {
    throw new Error("Supabase service role no configurado");
  }

  const conductorData = await loadConductorData(driverId, scopeDate);
  const routes = conductorData.routes
    .filter(
      (route) =>
        route.assignedTo === driverId &&
        route.routeDate === scopeDate &&
        (route.status === "planned" || route.status === "in_progress"),
    )
    .map((route) => ({
      id: route.id,
      name: route.name,
      routeDate: route.routeDate,
      status: route.status,
      vehicleId: route.vehicleId,
      stopCount: route.stops.length,
    }));
  const selectedRouteId =
    (routeId && routes.some((route) => route.id === routeId) ? routeId : null) ||
    routes.find((route) => route.status === "in_progress")?.id ||
    routes[0]?.id ||
    null;
  const currentVehicleId = routes.find((route) => route.id === selectedRouteId)?.vehicleId || null;
  const [events, stock] = await Promise.all([
    loadTruckEvents(supabase, session, currentVehicleId),
    loadTruckStock(admin, session),
  ]);
  const tasks = conductorTruckLoadTasks(conductorData.tasks, selectedRouteId);
  const scope = buildConductorTruckInventoryScope(tasks, scopeDate);
  const transferVehicles = await loadConductorTransferVehicles(admin, session, currentVehicleId);

  return {
    driverId,
    selectedRouteId,
    routes,
    scope,
    summary: buildConductorTruckInventory({
      tasks,
      events,
      stock,
      scope,
      includePersistentEvents: true,
    }),
    stock,
    cargo: buildConductorFullBoxCargo(events, selectedRouteId),
    currentVehicleId,
    transferVehicles,
  };
}

function findInventoryLine(summary: ConductorTruckInventorySummary, lineKey: string) {
  return summary.lines.find((line) => line.key === lineKey) || null;
}

function requireLineStock(line: ConductorTruckInventoryLine) {
  if (!line.itemId || !line.warehouseId) {
    throw new Error(`No hay stock registrado para ${line.label}`);
  }
}

function truckLineFromStockItem(item: ConductorTruckStockItem): ConductorTruckInventoryLine {
  return {
    key: conductorTruckLineKey({
      catalogKey: conductorTruckStockCatalogKey(item),
      label: item.itemName,
    }),
    catalogKey: conductorTruckStockCatalogKey(item),
    label: item.itemName,
    requiredQty: 0,
    loadedQty: 0,
    deliveredQty: 0,
    returnedQty: 0,
    currentQty: 0,
    shortageQty: 0,
    stockQty: item.stock,
    itemId: item.itemId,
    itemName: item.itemName,
    warehouseId: item.warehouseId,
    taskIds: [],
    routeIds: [],
  };
}

async function recordConductorWarehouseMovement(
  admin: Admin,
  session: AppSession,
  input: {
    line: ConductorTruckInventoryLine;
    type: "salida" | "devolucion" | "entrada";
    qty: number;
    note: string;
    driverId: string;
  },
) {
  requireLineStock(input.line);
  const qty = readPositiveIntegerQty(input.qty);

  if (!input.line.warehouseId || !input.line.itemId) {
    throw new Error(`Stock no encontrado para ${input.line.label}`);
  }

  await recordInventoryMovementAtomic(admin, {
    organizationId: session.organizationId,
    warehouseId: input.line.warehouseId,
    itemId: input.line.itemId,
    itemName: input.line.itemName || input.line.label,
    type: input.type,
    qty,
    note: input.note,
    createdBy: session.userId,
    assigneeId: input.driverId,
  });
}

function requireTruckVehicleId(view: ConductorTruckInventoryView) {
  if (!view.currentVehicleId) {
    throw new Error("Asigna un vehículo a la ruta antes de mover cajas del camión");
  }

  return view.currentVehicleId;
}

async function insertTruckEvent(admin: Admin, session: AppSession, input: {
  driverId: string;
  vehicleId: string;
  line: ConductorTruckInventoryLine;
  eventType: ConductorTruckInventoryEvent["eventType"];
  qty: number;
  taskId?: string | null;
  shipmentId?: string | null;
  routeId?: string | null;
  note?: string;
}) {
  const { error } = await admin.from("logistics_truck_inventory_events").insert({
    organization_id: session.organizationId,
    assigned_driver_id: input.driverId,
    vehicle_id: input.vehicleId,
    route_id: input.routeId || input.line.routeIds[0] || null,
    task_id: input.taskId || null,
    shipment_id: input.shipmentId || null,
    warehouse_id: input.line.warehouseId,
    item_id: input.line.itemId,
    item_name: input.line.itemName || input.line.label,
    catalog_key: input.line.catalogKey,
    item_label: input.line.label,
    event_type: input.eventType,
    qty: input.qty,
    note: input.note || "",
    created_by: session.userId,
  });

  if (error) {
    if (error.code === "23505" && input.eventType === "deliver") {
      return;
    }

    throw new Error(error.message);
  }
}

async function insertFullBoxCollectionEvent(
  admin: Admin,
  session: AppSession,
  input: {
    driverId: string;
    vehicleId: string;
    routeId: string;
    taskId: string;
    shipmentId: string;
    warehouseId: string | null;
    boxLine: { catalogKey: string; label: string; quantity: number };
    note: string;
  },
) {
  const { error } = await admin.from("logistics_truck_inventory_events").insert({
    organization_id: session.organizationId,
    assigned_driver_id: input.driverId,
    vehicle_id: input.vehicleId,
    route_id: input.routeId,
    task_id: input.taskId,
    shipment_id: input.shipmentId,
    warehouse_id: input.warehouseId,
    item_id: null,
    item_name: input.boxLine.label,
    catalog_key: input.boxLine.catalogKey,
    item_label: input.boxLine.label,
    event_type: "collect_full_box",
    qty: input.boxLine.quantity,
    note: input.note,
    created_by: session.userId,
  });

  if (error?.code !== "23505") {
    if (error) throw new Error(error.message);
  }
}

async function uploadEvidence(
  admin: Admin,
  session: AppSession,
  taskId: string,
  clientOperationId: string,
  file: File | null,
) {
  if (!file || !file.name || file.size <= 0) {
    return "";
  }

  if (file.size > EVIDENCE_MAX_BYTES) {
    throw new Error("Foto maxima: 8MB");
  }

  if (!EVIDENCE_TYPES.has(file.type)) {
    throw new Error("Foto debe ser JPG, PNG o WebP");
  }

  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "webp";
  const safeOperationId = clientOperationId.replace(/[^a-zA-Z0-9-]/g, "");
  const path = `${session.organizationId}/${taskId}/${safeOperationId}.${extension}`;
  const { error } = await admin.storage.from(LOGISTICS_TASK_EVIDENCE_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error && !/already exists|duplicate/i.test(error.message)) {
    throw new Error(error.message);
  }

  const { data } = await admin.storage.from(LOGISTICS_TASK_EVIDENCE_BUCKET).createSignedUrl(path, 60 * 60);
  return data?.signedUrl || path;
}

async function collectDriverPayment(admin: Admin, session: AppSession, shipment: ShipmentRow, input: {
  amount: number;
  method: PaymentMethod;
  note: string;
  expectedAmount: number;
  evidenceUrl: string;
}) {
  if (input.amount <= 0) {
    return null;
  }

  const quote = quoteFromShipment(shipment);
  const billing = readBillingFromPlan(shipment.logistics_plan);
  const quotedTotal = billing
    ? parseMoneyValue(billing.quotedTotal)
    : parseMoneyValue(quote?.total || String(shipment.paid));
  const cost = billing
    ? parseMoneyValue(billing.boxSubtotalBeforeDiscount) - parseMoneyValue(billing.promotionDiscount)
    : parseMoneyValue(quote?.cost || "$0");
  const settlement = settleConductorPayment({
    quotedTotal,
    alreadyPaid: shipment.paid,
    receivedAmount: input.amount,
  });
  const nextPlan = {
    ...shipment.logistics_plan,
    billing: billing
      ? {
          ...billing,
          quotedTotal: formatMoneyValue(settlement.adjustedQuotedTotal),
          payNow: formatMoneyValue(settlement.paid),
          balanceDue: formatMoneyValue(settlement.balanceDue),
          lastDriverCollection: {
            expectedAmount: input.expectedAmount,
            receivedAmount: input.amount,
            outcome: "collected",
            collectedAt: new Date().toISOString(),
            totalBefore: quotedTotal,
            totalAfter: settlement.adjustedQuotedTotal,
          },
        }
      : {
          quotedTotal: formatMoneyValue(settlement.adjustedQuotedTotal),
          payNow: formatMoneyValue(settlement.paid),
          balanceDue: formatMoneyValue(settlement.balanceDue),
          lastDriverCollection: {
            expectedAmount: input.expectedAmount,
            receivedAmount: input.amount,
            outcome: "collected",
            collectedAt: new Date().toISOString(),
            totalBefore: quotedTotal,
            totalAfter: settlement.adjustedQuotedTotal,
          },
        },
  };

  const { error } = await admin.rpc("collect_shipment_invoice_payment", {
    target_shipment_id: shipment.id,
    target_organization_id: session.organizationId,
    next_paid: settlement.paid,
    next_profit: settlement.isPaidInFull ? Math.max(settlement.paid - cost, 0) : shipment.profit,
    next_sale_kind: shipment.sale_kind,
    next_invoice_status: settlement.isPaidInFull ? "paid" : "open",
    next_accounting_status: settlement.isPaidInFull ? "exportable" : "not_exportable",
    next_finalized_at: settlement.isPaidInFull ? new Date().toISOString() : null,
    next_logistics_plan: nextPlan,
    payment_amount: input.amount,
    payment_method: input.method,
    payment_kind: "deposit",
    payment_note: input.note,
    payment_created_by: session.userId,
  });

  if (error) {
    throw new Error(error.message);
  }

  await recordActivityHistory(admin, session, {
    action: settlement.isPaidInFull ? "sale.invoice_finalized" : "sale.invoice_partial_payment",
    entityType: "shipment",
    entityId: shipment.id,
    title: settlement.isPaidInFull ? `Invoice cobrado: ${shipment.code}` : `Abono registrado: ${shipment.code}`,
    description: `${shipment.customer_name} - ${conductorCollectionAuditDescription({ expectedAmount: input.expectedAmount, receivedAmount: input.amount, outcome: "collected" })} - ${paymentMethodLabel(input.method)}`,
    metadata: {
      shipmentCode: shipment.code,
      source: "conductor.tareas",
      collectAmount: input.amount,
      expectedAmount: input.expectedAmount,
      receivedAmount: input.amount,
      paid: settlement.paid,
      balanceDue: settlement.balanceDue,
      quotedTotalBefore: quotedTotal,
      quotedTotalAfter: settlement.adjustedQuotedTotal,
      totalAdjusted: settlement.totalAdjusted,
      totalAdjustment: settlement.totalAdjustment,
      paymentMethod: input.method,
      paymentMethodLabel: paymentMethodLabel(input.method),
      paymentNote: input.note,
      evidenceUrl: input.evidenceUrl,
    },
  });

  return settlement;
}

async function recordTaskAttempt(admin: Admin, session: AppSession, input: {
  task: ConductorDriverTask;
  result: "completed" | "failed";
  driverId: string;
  failureReason: string;
  note: string;
  evidenceUrl: string;
  paymentExpectedAmount: number | null;
  paymentAmount: number;
  paymentMethod: PaymentMethod | "";
  paymentOutcome: ConductorPaymentOutcome;
  invoiceVisible: boolean;
  clientOperationId: string;
  capturedAt: string | null;
}) {
  const audit = conductorActionAudit(session, input.driverId);
  const note = formatConductorAdminActionNote(input.note, audit);
  const failureReason = input.result === "failed"
    ? formatConductorAdminActionNote(input.failureReason, audit)
    : "";

  const { error } = await admin.from("shipment_logistics_task_attempts").insert({
    organization_id: session.organizationId,
    shipment_id: input.task.shipmentId,
    task_id: input.task.id,
    route_id: input.task.routeId,
    driver_id: input.driverId,
    result: input.result,
    failure_reason: failureReason,
    note,
    evidence_url: input.evidenceUrl,
    payment_expected_amount: input.paymentExpectedAmount,
    payment_outcome: input.paymentOutcome,
    payment_amount: input.paymentOutcome === "not_applicable" ? null : input.paymentAmount,
    payment_method: input.paymentMethod || null,
    invoice_visible: input.invoiceVisible,
    client_operation_id: input.clientOperationId,
    captured_at: input.capturedAt,
    created_by: session.userId,
  });

  if (error) {
    if (error.code === "23505" && input.clientOperationId) {
      const { data: existingAttempt, error: lookupError } = await admin
        .from("shipment_logistics_task_attempts")
        .select("task_id, driver_id, result")
        .eq("organization_id", session.organizationId)
        .eq("client_operation_id", input.clientOperationId)
        .maybeSingle();

      if (lookupError) {
        throw new Error(lookupError.message);
      }

      if (
        existingAttempt?.task_id === input.task.id &&
        existingAttempt.driver_id === input.driverId &&
        existingAttempt.result === input.result
      ) {
        return;
      }
    }

    throw new Error(error.message);
  }
}

async function ensureShipmentPackages(
  admin: Admin,
  session: AppSession,
  shipment: ShipmentRow,
) {
  const rows = physicalPackageCodesForShipment(shipment.code, shipment.logistics_plan).map((code, index) => ({
    organization_id: session.organizationId,
    shipment_id: shipment.id,
    code,
    country: shipment.country || "",
    invoice_code: invoiceBoxCode(shipment.code, index),
  }));

  const { error } = await admin
    .from("shipment_packages")
    .upsert(rows, { onConflict: "organization_id,code", ignoreDuplicates: true });

  if (error) throw new Error(error.message);
}

async function recordInvoiceEvidence(admin: Admin, session: AppSession, input: {
  task: ConductorDriverTask;
  shipment: ShipmentRow;
  driverId: string;
  evidenceUrl: string;
}) {
  await ensureShipmentPackages(admin, session, input.shipment);

  const now = new Date().toISOString();
  const commonPatch = {
    invoice_incident_at: null,
    invoice_incident_reason: "",
  };
  const patch = input.task.taskType === "deliver_empty_box"
    ? {
        ...commonPatch,
        invoice_marked_at: now,
        invoice_marked_by: input.driverId,
        invoice_delivery_evidence_url: input.evidenceUrl,
      }
    : {
        ...commonPatch,
        invoice_marked_at: now,
        invoice_marked_by: input.driverId,
        invoice_pickup_confirmed_at: now,
        invoice_pickup_confirmed_by: input.driverId,
        invoice_pickup_evidence_url: input.evidenceUrl,
      };

  const { error } = await admin
    .from("shipment_packages")
    .update(patch)
    .eq("organization_id", session.organizationId)
    .eq("shipment_id", input.shipment.id);

  if (error) throw new Error(error.message);

  await recordActivityHistory(admin, session, {
    action: input.task.taskType === "deliver_empty_box"
      ? "shipment.invoice_box_delivery_confirmed"
      : "shipment.invoice_box_pickup_confirmed",
    entityType: "shipment",
    entityId: input.shipment.id,
    title: input.task.taskType === "deliver_empty_box"
      ? "Invoice escrito en caja confirmado"
      : "Invoice en caja confirmado al recoger",
    description: `${input.shipment.code}: foto de evidencia con invoice visible.`,
    metadata: {
      source: "conductor.tareas",
      taskId: input.task.id,
      taskType: input.task.taskType,
      evidenceUrl: input.evidenceUrl,
      invoiceCode: input.shipment.code,
      ...conductorActionAuditMetadata(session, input.driverId),
    },
  });
}

async function recordInvoiceIncident(admin: Admin, session: AppSession, input: {
  shipment: ShipmentRow;
  driverId: string;
  task: ConductorDriverTask;
  evidenceUrl: string;
}) {
  await ensureShipmentPackages(admin, session, input.shipment);

  const now = new Date().toISOString();
  const { error } = await admin
    .from("shipment_packages")
    .update({
      invoice_incident_at: now,
      invoice_incident_reason: "Invoice no visible",
    })
    .eq("organization_id", session.organizationId)
    .eq("shipment_id", input.shipment.id);

  if (error) throw new Error(error.message);

  await recordActivityHistory(admin, session, {
    action: "shipment.invoice_box_missing",
    entityType: "shipment",
    entityId: input.shipment.id,
    title: "Incidente: invoice no visible en caja",
    description: `${input.shipment.code}: la visita se canceló porque el invoice no se veía en la caja.`,
    metadata: {
      source: "conductor.tareas",
      taskId: input.task.id,
      taskType: input.task.taskType,
      evidenceUrl: input.evidenceUrl,
      invoiceCode: input.shipment.code,
      ...conductorActionAuditMetadata(session, input.driverId),
    },
  });
}

async function completeTask(admin: Admin, session: AppSession, input: {
  task: ConductorDriverTask;
  shipment: ShipmentRow;
  driverId: string;
  evidenceUrl: string;
  note: string;
  paymentExpectedAmount: number;
  paymentAmount: number;
  paymentMethod: PaymentMethod;
  paymentOutcome: ConductorPaymentOutcome;
}) {
  const now = new Date().toISOString();
  const milestoneKey = milestoneKeyForLogisticsTask(input.task.taskType);
  const milestonePatch = milestoneKey
    ? buildFirstMilestonePatch(readShipmentMilestones(input.shipment), [{ key: milestoneKey, recordedAt: now }])
    : {};
  const nextLogisticsTasks = input.shipment.logisticsTasks.map((task) =>
    task.id === input.task.id ? { ...task, status: "completed" as const, completedAt: now } : task,
  );
  const statusPatch = syncShipmentStatusPatch({
    ...input.shipment,
    ...milestonePatch,
    logisticsTasks: nextLogisticsTasks,
  });
  const noCollectionPlan = input.paymentOutcome === "not_collected"
    ? (() => {
        const billing = readBillingFromPlan(input.shipment.logistics_plan);
        const quotedTotal = billing
          ? parseMoneyValue(billing.quotedTotal)
          : parseMoneyValue(quoteFromShipment(input.shipment)?.total || "$0");

        return {
          ...input.shipment.logistics_plan,
          billing: {
            ...(billing || {
              quotedTotal: formatMoneyValue(quotedTotal),
              payNow: formatMoneyValue(input.shipment.paid),
              balanceDue: formatMoneyValue(Math.max(quotedTotal - input.shipment.paid, 0)),
            }),
            lastDriverCollection: {
              expectedAmount: input.paymentExpectedAmount,
              receivedAmount: 0,
              outcome: "not_collected",
              collectedAt: now,
              totalBefore: quotedTotal,
              totalAfter: quotedTotal,
            },
          },
        };
      })()
    : null;

  const taskPatch: Record<string, string | null> = {
    status: "completed",
    completed_at: now,
    notes: input.note,
    updated_at: now,
  };

  if (input.task.taskType === "deliver_empty_box") {
    taskPatch.loaded_at = now;
    taskPatch.stock_deducted_at = now;
  }

  const { error: taskError } = await admin
    .from("shipment_logistics_tasks")
    .update(taskPatch)
    .eq("id", input.task.id)
    .eq("organization_id", session.organizationId);

  if (taskError) {
    throw new Error(taskError.message);
  }

  if (Object.keys(milestonePatch).length || statusPatch.status || noCollectionPlan) {
    const { error: shipmentError } = await admin
      .from("shipments")
      .update({
        ...milestonePatch,
        ...statusPatch,
        ...(noCollectionPlan ? { logistics_plan: noCollectionPlan } : {}),
      })
      .eq("id", input.shipment.id)
      .eq("organization_id", session.organizationId);

    if (shipmentError) {
      throw new Error(shipmentError.message);
    }
  }

  const settlement = await collectDriverPayment(admin, session, input.shipment, {
    amount: input.paymentAmount,
    method: input.paymentMethod,
    note: input.note,
    expectedAmount: input.paymentExpectedAmount,
    evidenceUrl: input.evidenceUrl,
  });

  if (input.paymentOutcome === "not_collected") {
    await recordActivityHistory(admin, session, {
      action: "shipment.driver_payment_not_collected",
      entityType: "shipment",
      entityId: input.shipment.id,
      title: `Cobro pendiente: ${input.shipment.code}`,
      description: conductorCollectionAuditDescription({
        expectedAmount: input.paymentExpectedAmount,
        receivedAmount: 0,
        outcome: "not_collected",
      }),
      metadata: {
        shipmentCode: input.shipment.code,
        source: "conductor.tareas",
        taskId: input.task.id,
        expectedAmount: input.paymentExpectedAmount,
        receivedAmount: 0,
        paymentOutcome: input.paymentOutcome,
        evidenceUrl: input.evidenceUrl,
        note: input.note,
        ...conductorActionAuditMetadata(session, input.driverId),
      },
    });
  }

  await recordActivityHistory(admin, session, {
    action: "shipment.logistics_task_updated",
    entityType: "shipment",
    entityId: input.shipment.id,
    title: `Tarea logistica: completed`,
    description: `${input.shipment.code} - ${conductorTaskTypeLabel[input.task.taskType]} - ${formatConductorAdminActorDescription(conductorActionAudit(session, input.driverId), "conductor")} completo`,
    metadata: {
      shipmentCode: input.shipment.code,
      taskId: input.task.id,
      taskType: input.task.taskType,
      status: "completed",
      source: "conductor.tareas",
      driverId: input.driverId,
      evidenceUrl: input.evidenceUrl,
      note: input.note,
      completedAt: now,
      expectedPaymentAmount: input.paymentExpectedAmount || null,
      paymentAmount: input.paymentAmount,
      paymentMethod: input.paymentAmount > 0 ? input.paymentMethod : null,
      paymentOutcome: input.paymentOutcome,
      paymentSettlement: settlement,
      ...conductorActionAuditMetadata(session, input.driverId),
    },
  });
}

async function failTask(admin: Admin, session: AppSession, input: {
  task: ConductorDriverTask;
  shipment: ShipmentRow;
  driverId: string;
  failureReason: ConductorTaskFailureReason;
  note: string;
  evidenceUrl: string;
}) {
  const now = new Date().toISOString();
  const audit = conductorActionAudit(session, input.driverId);
  const fullNote = [input.failureReason, input.note].filter(Boolean).join(" - ");
  const auditedFullNote = formatConductorAdminActionNote(fullNote, audit);

  const { error: taskError } = await admin
    .from("shipment_logistics_tasks")
    .update({
      status: "cancelled",
      notes: auditedFullNote,
      completed_at: null,
      updated_at: now,
    })
    .eq("id", input.task.id)
    .eq("organization_id", session.organizationId);

  if (taskError) {
    throw new Error(taskError.message);
  }

  const outcome = input.failureReason === "Cliente no contesto" ? "no_answer" : "other";
  const { error: contactError } = await admin.from("shipment_contact_logs").insert({
    organization_id: session.organizationId,
    shipment_id: input.shipment.id,
    channel: "other",
    channel_other: "Conductor",
    outcome,
    note: auditedFullNote,
    next_step: "Reprogramar con logistica",
    follow_up_at: null,
    created_by: session.userId,
  });

  if (contactError) {
    throw new Error(contactError.message);
  }

  await recordActivityHistory(admin, session, {
    action: "shipment.contact_log_created",
    entityType: "shipment",
    entityId: input.shipment.id,
    title: `Seguimiento - ${input.shipment.code}`,
    description: `${formatConductorAdminActorDescription(audit, "Conductor")}: ${auditedFullNote}`,
    metadata: {
      shipmentCode: input.shipment.code,
      source: "conductor.tareas",
      taskId: input.task.id,
      taskType: input.task.taskType,
      failureReason: input.failureReason,
      evidenceUrl: input.evidenceUrl,
      ...conductorActionAuditMetadata(session, input.driverId),
    },
  });

  await recordActivityHistory(admin, session, {
    action: "shipment.logistics_task_failed",
    entityType: "shipment",
    entityId: input.shipment.id,
    title: `Tarea cancelada: ${input.shipment.code}`,
    description: `${conductorTaskTypeLabel[input.task.taskType]} - ${auditedFullNote}`,
    metadata: {
      shipmentCode: input.shipment.code,
      source: "conductor.tareas",
      taskId: input.task.id,
      taskType: input.task.taskType,
      status: "cancelled",
      driverId: input.driverId,
      failureReason: input.failureReason,
      note: input.note,
      evidenceUrl: input.evidenceUrl,
      cancelledAt: now,
      ...conductorActionAuditMetadata(session, input.driverId),
    },
  });
}

export async function listConductorDriverTasksAction(
  driverId: string,
): Promise<ActionResult<ConductorDriverTask[]>> {
  try {
    const session = await requireAppSession();
    const cleanDriverId = driverId.trim();

    if (!cleanDriverId) {
      return ok([]);
    }

    if (!canPreviewConductorTasks(session.roleSlug) && session.userId !== cleanDriverId) {
      throw new Error("FORBIDDEN");
    }

    const { tasks } = await loadConductorData(cleanDriverId);
    return ok(tasks);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function listConductorClosedDriverTasksAction(
  driverId: string,
): Promise<ActionResult<ConductorDriverTask[]>> {
  try {
    const session = await requireAppSession();
    const cleanDriverId = driverId.trim();

    if (!cleanDriverId) {
      return ok([]);
    }

    if (!canPreviewConductorTasks(session.roleSlug) && session.userId !== cleanDriverId) {
      throw new Error("FORBIDDEN");
    }

    const data = await loadConductorData(cleanDriverId);

    return ok(
      buildConductorDriverTasks({
        shipments: data.shipments,
        routes: data.routes,
        taskAddresses: data.taskAddresses,
        vehicles: data.vehicles,
        driverId: cleanDriverId,
        scopeDate: data.scopeDate,
        visibility: "closed",
      }),
    );
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}





export async function getConductorTruckInventoryAction(
  driverId?: string | null,
  routeId?: string | null,
): Promise<ActionResult<ConductorTruckInventoryView>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "routes.view")) {
      throw new Error("FORBIDDEN");
    }

    const effectiveDriverId = resolveConductorActionDriverId(session, driverId);
    return ok(await loadTruckInventoryView(session, effectiveDriverId, routeId));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function getConductorHomeVehicleStatusAction(
  driverId?: string | null,
): Promise<ActionResult<ConductorHomeVehicleStatus>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "routes.view")) {
      throw new Error("FORBIDDEN");
    }

    const effectiveDriverId = resolveConductorActionDriverId(session, driverId);
    const view = await loadTruckInventoryView(session, effectiveDriverId);
    const route = view.routes.find((entry) => entry.id === view.selectedRouteId);

    if (!route) {
      return ok({
        routeName: null,
        routeStatus: null,
        vehicleLabel: null,
        status: "no_route",
      });
    }

    if (!route.vehicleId) {
      return ok({
        routeName: route.name,
        routeStatus: route.status,
        vehicleLabel: null,
        status: "unassigned",
      });
    }

    const admin = createSupabaseAdminClient();

    if (!admin) {
      return fail("Supabase service role no configurado");
    }

    const { data: vehicle, error } = await admin
      .from("logistics_vehicles")
      .select("name, plate, is_active")
      .eq("id", route.vehicleId)
      .eq("organization_id", session.organizationId)
      .maybeSingle();

    if (error) {
      return fail(error.message);
    }

    const label = vehicle
      ? [vehicle.name, vehicle.plate].filter(Boolean).join(" · ") || "Vehículo asignado"
      : "Vehículo no encontrado";

    return ok({
      routeName: route.name,
      routeStatus: route.status,
      vehicleLabel: label,
      status: vehicle?.is_active ? "active" : "inactive",
    });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function listConductorTruckBalancesAction(): Promise<
  ActionResult<ConductorTruckBalance[]>
> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "inventory.view")) {
      throw new Error("FORBIDDEN");
    }

    const admin = createSupabaseAdminClient();

    if (!admin) {
      return fail("Supabase service role no configurado");
    }

    const [{ data: profileRows, error: profileError }, { data: eventRows, error: eventError }, { data: vehicleRows, error: vehicleError }] =
      await Promise.all([
        admin
          .from("profiles")
          .select("id, email, full_name, roles(slug)")
          .eq("organization_id", session.organizationId)
          .eq("is_active", true)
          .order("full_name"),
        admin
          .from("logistics_truck_inventory_events")
          .select(
            "id, vehicle_id, assigned_driver_id, event_type, route_id, task_id, shipment_id, warehouse_id, item_id, item_name, catalog_key, item_label, qty, created_at",
          )
          .eq("organization_id", session.organizationId)
          .order("created_at", { ascending: true }),
        admin
          .from("logistics_vehicles")
          .select("id, name, plate, assigned_driver_id, is_active")
          .eq("organization_id", session.organizationId)
          .eq("is_active", true)
          .order("name"),
      ]);

    if (profileError) {
      return fail(profileError.message);
    }

    if (eventError && eventError.code !== "42P01") {
      return fail(eventError.message);
    }

    if (vehicleError && vehicleError.code !== "42P01") {
      return fail(vehicleError.message);
    }

    const driverNameById = new Map<string, string>();

    for (const row of ((profileRows || []) as unknown as ConductorProfileDbRow[])) {
      const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;

      if (role?.slug === "conductor") {
        driverNameById.set(row.id, row.full_name?.trim() || row.email);
      }
    }

    const stock = await loadTruckStock(admin, session);
    const events = ((eventRows || []) as (TruckEventDbRow & { vehicle_id: string | null })[]).map(
      mapTruckEvent,
    );
    const eventsById = new Map(events.map((event) => [event.id, event]));
    const eventsByVehicle = new Map<string, ConductorTruckInventoryEvent[]>();

    for (const row of (eventRows || []) as (TruckEventDbRow & { vehicle_id: string | null })[]) {
      if (!row.vehicle_id) {
        continue;
      }

      const vehicleEvents = eventsByVehicle.get(row.vehicle_id) || [];
      const mapped = eventsById.get(row.id);

      if (mapped) {
        vehicleEvents.push(mapped);
        eventsByVehicle.set(row.vehicle_id, vehicleEvents);
      }
    }

    const vehicles = (vehicleRows || []) as {
      id: string;
      name: string | null;
      plate: string | null;
      assigned_driver_id: string | null;
    }[];

    const vehicleIdsWithEvents = new Set(
      (eventRows || [])
        .map((row) => (row as { vehicle_id?: string | null }).vehicle_id)
        .filter((vehicleId): vehicleId is string => Boolean(vehicleId)),
    );

    const balances = [
      ...vehicles.map((vehicle) =>
        buildConductorTruckBalance({
          vehicleId: vehicle.id,
          vehicleName: String(vehicle.name || "").trim(),
          vehiclePlate: String(vehicle.plate || "").trim(),
          assignedDriverId: vehicle.assigned_driver_id,
          assignedDriverName: vehicle.assigned_driver_id
            ? driverNameById.get(vehicle.assigned_driver_id) || ""
            : "",
          events: eventsByVehicle.get(vehicle.id) || [],
          stock,
        }),
      ),
      ...[...vehicleIdsWithEvents]
        .filter((vehicleId) => !vehicles.some((vehicle) => vehicle.id === vehicleId))
        .map((vehicleId) =>
          buildConductorTruckBalance({
            vehicleId,
            vehicleName: "Vehículo",
            vehiclePlate: "",
            assignedDriverId: null,
            assignedDriverName: "",
            events: eventsByVehicle.get(vehicleId) || [],
            stock,
          }),
        ),
    ];

    return ok(balances);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function loadConductorTruckLineAction(input: {
  driverId?: string | null;
  routeId?: string | null;
  lineKey: string;
  qty?: number;
}): Promise<ActionResult<ConductorTruckInventoryView>> {
  try {
    const session = await requireAppSession();

    if (!canWriteDriverTask(session)) {
      throw new Error("FORBIDDEN");
    }

    const driverId = resolveConductorActionDriverId(session, input.driverId);
    const admin = createSupabaseAdminClient();

    if (!admin) {
      return fail("Supabase service role no configurado");
    }

    const view = await loadTruckInventoryView(session, driverId, input.routeId);
    const line = findInventoryLine(view.summary, input.lineKey);
    const vehicleId = requireTruckVehicleId(view);

    if (!line) {
      return fail("Caja no encontrada");
    }

    const qty = Math.max(Math.floor(Number(input.qty) || line.shortageQty), 1);

    const validationError = validateConductorTruckLoad(line, qty);

    if (validationError) {
      return fail(validationError);
    }

    await recordConductorWarehouseMovement(admin, session, {
      line,
      type: "salida",
      qty,
      note: `Carga camion - ${line.label}`,
      driverId,
    });
    await insertTruckEvent(admin, session, {
      driverId,
      vehicleId,
      line,
      eventType: "load",
      qty,
      routeId: view.selectedRouteId,
      note: `Carga camion - ${line.label}`,
    });

    await recordActivityHistory(admin, session, {
      action: "logistics.truck_inventory_loaded",
      entityType: "profile",
      entityId: driverId,
      title: `Camion cargado`,
      description: `${qty} - ${line.label}`,
      metadata: {
        source: "conductor.inventario_camion",
        driverId,
        lineKey: line.key,
        qty,
        label: line.label,
        ...conductorActionAuditMetadata(session, driverId),
      },
    });

    revalidatePath("/conductor/inventario-camion");
    revalidatePath("/conductor/tareas");
    revalidatePath("/inventario");
    return ok(await loadTruckInventoryView(session, driverId, view.selectedRouteId));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function loadConductorTruckExtraAction(input: {
  driverId?: string | null;
  routeId?: string | null;
  itemId: string;
  warehouseId: string;
  qty: number;
}): Promise<ActionResult<ConductorTruckInventoryView>> {
  try {
    const session = await requireAppSession();

    if (!canWriteDriverTask(session)) {
      throw new Error("FORBIDDEN");
    }

    const driverId = resolveConductorActionDriverId(session, input.driverId);
    const admin = createSupabaseAdminClient();

    if (!admin) {
      return fail("Supabase service role no configurado");
    }

    const view = await loadTruckInventoryView(session, driverId, input.routeId);
    const item = view.stock.find(
      (entry) => entry.itemId === input.itemId && entry.warehouseId === input.warehouseId,
    );
    const vehicleId = requireTruckVehicleId(view);

    if (!item) {
      return fail("Item no encontrado en la bodega");
    }

    const qty = readPositiveIntegerQty(input.qty);

    if (qty > item.stock) {
      return fail(`Stock insuficiente para ${item.itemName}`);
    }

    const line = truckLineFromStockItem(item);
    const note = `Caja extra al camion - ${line.label}`;

    await recordConductorWarehouseMovement(admin, session, {
      line,
      type: "salida",
      qty,
      note,
      driverId,
    });
    await insertTruckEvent(admin, session, {
      driverId,
      vehicleId,
      line,
      eventType: "load",
      qty,
      routeId: view.selectedRouteId,
      note,
    });

    await recordActivityHistory(admin, session, {
      action: "logistics.truck_inventory_extra_loaded",
      entityType: "profile",
      entityId: driverId,
      title: "Caja extra al camión",
      description: `${qty} - ${line.label}`,
      metadata: {
        source: "conductor.inventario_camion",
        driverId,
        itemId: line.itemId,
        warehouseId: line.warehouseId,
        qty,
        label: line.label,
        ...conductorActionAuditMetadata(session, driverId),
      },
    });

    revalidatePath("/conductor/inventario-camion");
    revalidatePath("/conductor/tareas");
    revalidatePath("/inventario");
    return ok(await loadTruckInventoryView(session, driverId, view.selectedRouteId));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function returnConductorTruckLineAction(input: {
  driverId?: string | null;
  routeId?: string | null;
  lineKey: string;
  qty?: number;
  reason: string;
  note?: string;
  origin?: "route" | "extra";
  targetVehicleId?: string | null;
}): Promise<ActionResult<ConductorTruckInventoryView>> {
  try {
    const session = await requireAppSession();

    if (!canWriteDriverTask(session)) {
      throw new Error("FORBIDDEN");
    }

    const driverId = resolveConductorActionDriverId(session, input.driverId);
    const admin = createSupabaseAdminClient();

    if (!admin) {
      return fail("Supabase service role no configurado");
    }

    const reasonError = validateConductorTruckReturnInput({
      reason: input.reason,
      targetVehicleId: input.targetVehicleId,
    });

    if (reasonError) {
      return fail(reasonError);
    }

    const view = await loadTruckInventoryView(session, driverId, input.routeId);
    const line = findInventoryLine(view.summary, input.lineKey);
    const sourceVehicleId = requireTruckVehicleId(view);

    if (!line) {
      return fail("Caja no encontrada");
    }

    const qty = Math.max(Math.floor(Number(input.qty) || line.currentQty), 1);

    const validationError = validateConductorTruckReturn(line, qty);

    if (validationError) {
      return fail(validationError);
    }

    const reason = cleanText(input.reason, 80);
    const detailNote = cleanText(input.note, 280);
    const originLabel =
      input.origin === "extra"
        ? "caja extra"
        : input.origin === "route"
          ? "caja de ruta"
          : "caja";
    let targetVehicleLabel = "";
    let targetVehicleId = "";

    if (isConductorTruckVehicleChangeReason(reason)) {
      const targetVehicle = view.transferVehicles.find(
        (vehicle) => vehicle.id === String(input.targetVehicleId || "").trim(),
      );

      if (!targetVehicle) {
        return fail("Vehículo destino no válido");
      }

      targetVehicleId = targetVehicle.id;
      targetVehicleLabel = targetVehicle.label;
    }

    const eventNote = [
      isConductorTruckVehicleChangeReason(reason)
        ? `Transferencia entre camiones (${originLabel})`
        : `Baja de camion (${originLabel})`,
      `Motivo: ${reason}`,
      targetVehicleLabel ? `Destino: ${targetVehicleLabel}` : "",
      detailNote,
    ]
      .filter(Boolean)
      .join(" · ");

    if (isConductorTruckVehicleChangeReason(reason)) {
      await insertTruckEvent(admin, session, {
        driverId,
        vehicleId: sourceVehicleId,
        line,
        eventType: "return",
        qty,
        routeId: view.selectedRouteId,
        note: eventNote,
      });
      await insertTruckEvent(admin, session, {
        driverId,
        vehicleId: targetVehicleId,
        line,
        eventType: "load",
        qty,
        routeId: view.selectedRouteId,
        note: eventNote,
      });
    } else {
      await recordConductorWarehouseMovement(admin, session, {
        line,
        type: "devolucion",
        qty,
        note: eventNote,
        driverId,
      });
      await insertTruckEvent(admin, session, {
        driverId,
        vehicleId: sourceVehicleId,
        line,
        eventType: "return",
        qty,
        routeId: view.selectedRouteId,
        note: eventNote,
      });
    }

    await recordActivityHistory(admin, session, {
      action: "logistics.truck_inventory_returned",
      entityType: "profile",
      entityId: driverId,
      title: isConductorTruckVehicleChangeReason(reason)
        ? "Cajas transferidas de camión"
        : `Caja bajada del camion`,
      description: targetVehicleLabel
        ? `${qty} - ${line.label} · ${reason} · ${targetVehicleLabel}`
        : `${qty} - ${line.label} · ${reason}`,
      metadata: {
        source: "conductor.inventario_camion",
        driverId,
        vehicleId: sourceVehicleId,
        lineKey: line.key,
        qty,
        label: line.label,
        reason,
        note: detailNote,
        origin: input.origin || null,
        targetVehicleId: targetVehicleId || null,
        targetVehicleLabel: targetVehicleLabel || null,
        ...conductorActionAuditMetadata(session, driverId),
      },
    });

    revalidatePath("/conductor/inventario-camion");
    revalidatePath("/conductor/tareas");
    revalidatePath("/inventario");
    return ok(await loadTruckInventoryView(session, driverId, view.selectedRouteId));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function startConductorRouteAction(input: {
  routeId: string;
  driverId?: string | null;
}): Promise<ActionResult<ConductorTruckInventoryView>> {
  try {
    const session = await requireAppSession();

    if (!canWriteDriverTask(session)) {
      throw new Error("FORBIDDEN");
    }

    const effectiveDriverId = resolveConductorActionDriverId(session, input.driverId);
    const routeId = cleanText(input.routeId, 80);
    const admin = createSupabaseAdminClient();

    if (!admin) {
      return fail("Supabase service role no configurado");
    }

    if (!routeId) {
      return fail("Selecciona una ruta");
    }

    const view = await loadTruckInventoryView(session, effectiveDriverId, routeId);

    if (view.selectedRouteId !== routeId) {
      return fail("La ruta no esta asignada a este conductor para hoy");
    }

    const { data: routeRow, error: routeError } = await admin
      .from("logistics_routes")
      .select("id, name, route_date, status, assigned_to, vehicle_id, warehouse_id")
      .eq("id", routeId)
      .eq("organization_id", session.organizationId)
      .maybeSingle();

    if (routeError) return fail(routeError.message);
    if (!routeRow || routeRow.assigned_to !== effectiveDriverId) {
      throw new Error("FORBIDDEN");
    }
    if (routeRow.status !== "planned") {
      return fail(routeRow.status === "in_progress" ? "La ruta ya esta en curso" : "La ruta todavia no fue enviada");
    }

    const [{ data: driver }, { data: vehicle }, { data: warehouse }, { data: stops, error: stopsError }] =
      await Promise.all([
        admin
          .from("profiles")
          .select("id, is_active")
          .eq("id", effectiveDriverId)
          .eq("organization_id", session.organizationId)
          .maybeSingle(),
        admin
          .from("logistics_vehicles")
          .select("id, is_active")
          .eq("id", routeRow.vehicle_id)
          .eq("organization_id", session.organizationId)
          .maybeSingle(),
        admin
          .from("warehouses")
          .select("id, lat, lng, address_verified, is_active")
          .eq("id", routeRow.warehouse_id)
          .eq("organization_id", session.organizationId)
          .maybeSingle(),
        admin
          .from("logistics_route_stops")
          .select("id, task_id, lat, lng")
          .eq("route_id", routeId)
          .eq("organization_id", session.organizationId)
          .is("released_at", null),
      ]);

    if (stopsError) return fail(stopsError.message);
    if (!driver?.is_active) return fail("El conductor no esta activo");
    if (!vehicle?.is_active) return fail("El vehiculo no esta activo");
    if (
      !warehouse?.is_active ||
      !warehouse.address_verified ||
      !Number.isFinite(Number(warehouse.lat)) ||
      !Number.isFinite(Number(warehouse.lng))
    ) {
      return fail("La bodega no tiene una ubicacion verificada");
    }
    if (!stops?.length) return fail("La ruta no tiene paradas");
    if (stops.some((stop) => !Number.isFinite(Number(stop.lat)) || !Number.isFinite(Number(stop.lng)))) {
      return fail("Hay paradas con direccion sin verificar");
    }

    const stopTaskIds = stops.map((stop) => String(stop.task_id));
    const { data: scheduledTasks, error: scheduleError } = await admin
      .from("shipment_logistics_tasks")
      .select("id, scheduled_at, window_start_at, schedule_confirmation_status")
      .eq("organization_id", session.organizationId)
      .in("id", stopTaskIds);

    if (scheduleError) return fail(scheduleError.message);
    if (
      (scheduledTasks || []).length !== stopTaskIds.length ||
      (scheduledTasks || []).some(
        (task) =>
          (!task.scheduled_at && !task.window_start_at) ||
          task.schedule_confirmation_status !== "confirmed" ||
          (task.scheduled_at || task.window_start_at || "").slice(0, 10) !== routeRow.route_date,
      )
    ) {
      return fail("Todas las paradas necesitan fecha confirmada para hoy");
    }

    if (!view.summary.ready) {
      return fail("Faltan cajas para iniciar ruta");
    }

    const taskIds = [...new Set(view.summary.lines.flatMap((line) => line.taskIds))];

    if (taskIds.length) {
      const now = new Date().toISOString();
      const { error } = await admin
        .from("shipment_logistics_tasks")
        .update({
          status: "loaded_to_truck",
          loaded_at: now,
          stock_deducted_at: now,
          updated_at: now,
        })
        .eq("organization_id", session.organizationId)
        .in("id", taskIds);

      if (error) {
        return fail(error.message);
      }
    }

    const now = new Date().toISOString();
    const { error: startError } = await admin
      .from("logistics_routes")
      .update({
        status: "in_progress",
        started_at: now,
        started_by: session.userId,
        updated_at: now,
      })
      .eq("id", routeId)
      .eq("organization_id", session.organizationId)
      .eq("status", "planned");

    if (startError) return fail(startError.message);

    await recordActivityHistory(admin, session, {
      action: "logistics.route_started",
      entityType: "logistics_route",
      entityId: routeId,
      title: `Ruta iniciada: ${routeRow.name}`,
      description: `${view.summary.currentTotal} cajas en camion`,
      metadata: {
        source: "conductor.inventario_camion",
        driverId: effectiveDriverId,
        routeId,
        taskIds,
        lines: view.summary.lines.map((line) => ({
          label: line.label,
          currentQty: line.currentQty,
          requiredQty: line.requiredQty,
        })),
        ...conductorActionAuditMetadata(session, effectiveDriverId),
      },
    });

    revalidatePath("/conductor/inventario-camion");
    revalidatePath("/conductor/tareas");
    revalidatePath("/logistica");
    return ok(await loadTruckInventoryView(session, effectiveDriverId, routeId));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}


export async function submitConductorTaskResultAction(
  formData: FormData,
): Promise<ActionResult<{ taskId: string }>> {
  try {
    const session = await requireAppSession();

    if (!canWriteDriverTask(session)) {
      throw new Error("FORBIDDEN");
    }

    const admin = createSupabaseAdminClient();

    if (!admin) {
      return fail("Supabase service role no configurado");
    }

    const driverId = resolveConductorActionDriverId(session, cleanText(formData.get("driverId"), 80) || null);
    const taskId = cleanText(formData.get("taskId"), 80);
    const result = cleanText(formData.get("result"), 20) === "failed" ? "failed" : "completed";
    const failureReason = cleanText(formData.get("failureReason"), 120);
    const note = cleanText(formData.get("note"), 1000);
    const paymentChoiceValue = cleanText(formData.get("paymentChoice"), 20);
    const customPaymentAmount = Math.max(parseMoneyValue(cleanText(formData.get("paymentAmount"), 40)), 0);
    const paymentMethod = readPaymentMethod(formData.get("paymentMethod"));
    const operationIdValue = cleanText(formData.get("operationId"), 80);
    const clientOperationId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationIdValue)
      ? operationIdValue
      : randomUUID();
    const capturedAtValue = cleanText(formData.get("capturedAt"), 80);
    const capturedAtDate = capturedAtValue ? new Date(capturedAtValue) : null;
    const capturedAt = capturedAtDate && !Number.isNaN(capturedAtDate.getTime())
      ? capturedAtDate.toISOString()
      : null;
    const evidence = formData.get("evidence");
    const evidenceFile = evidence instanceof File && evidence.name ? evidence : null;
    const invoiceVisible = cleanText(formData.get("invoiceVisible"), 10) === "true";

    if (!taskId) {
      return fail("Falta tarea");
    }

    const taskRow = await loadDriverTaskFromDb(admin, session, taskId);

    if (!taskRow) {
      throw new Error("FORBIDDEN");
    }

    if (taskRow.status === "completed") {
      return ok({ taskId });
    }

    if (taskRow.status === "cancelled") {
      const { data: repeatedAttempt } = await admin
        .from("shipment_logistics_task_attempts")
        .select("id")
        .eq("organization_id", session.organizationId)
        .eq("client_operation_id", clientOperationId)
        .maybeSingle();
      return repeatedAttempt ? ok({ taskId }) : fail("Tarea cancelada");
    }

    const taskScopeDate = scheduledAtScopeDate(taskRow.scheduled_at) || conductorScopeDate();
    const { tasks, shipments, routes } = await loadConductorData(driverId, taskScopeDate);
    const routeByTaskId = buildRouteByTaskId(routes);
    const routeInfo = routeByTaskId.get(taskRow.id);

    if (
      !isTaskAssignedToDriver(
        { assignedTo: taskRow.assigned_to, status: taskRow.status },
        routeInfo,
        driverId,
      )
    ) {
      throw new Error("FORBIDDEN");
    }

    const task = tasks.find((entry) => entry.id === taskId);

    if (!task) {
      throw new Error("FORBIDDEN");
    }

    const hasDeliveryCollection =
      result === "completed" && task.taskType === "deliver_empty_box" && task.balanceDue > 0;
    const expectedPaymentAmount = hasDeliveryCollection
      ? task.depositDue > 0
        ? task.depositDue
        : task.balanceDue
      : 0;
    let paymentAmount = 0;
    let paymentOutcome: ConductorPaymentOutcome = "not_applicable";

    if (hasDeliveryCollection) {
      const paymentChoice = isConductorPaymentChoice(paymentChoiceValue) ? paymentChoiceValue : null;
      const paymentChoiceError = conductorPaymentChoiceError({
        choice: paymentChoice,
        expectedAmount: expectedPaymentAmount,
        customAmount: customPaymentAmount,
      });

      if (paymentChoiceError) {
        return fail(paymentChoiceError);
      }

      const resolvedPayment = resolveConductorPaymentAmount({
        choice: paymentChoice!,
        expectedAmount: expectedPaymentAmount,
        customAmount: customPaymentAmount,
      });
      paymentAmount = resolvedPayment.amount;
      paymentOutcome = resolvedPayment.outcome;
    }

    const validationError = validateConductorTaskResultInput({
      result,
      taskType: task.taskType,
      failureReason,
      evidenceFileName: evidenceFile?.name,
      invoiceVisible,
      paymentAmount,
    });

    if (validationError) {
      return fail(validationError);
    }

    const shipment = shipments.find((entry) => entry.id === task.shipmentId);

    if (!shipment) {
      return fail("Invoice no encontrado");
    }

    const evidenceUrl = await uploadEvidence(admin, session, task.id, clientOperationId, evidenceFile);

    if (result === "completed") {
      await recordInvoiceEvidence(admin, session, {
        task,
        shipment,
        driverId,
        evidenceUrl,
      });
    } else if (failureReason === "Invoice no visible") {
      await recordInvoiceIncident(admin, session, {
        task,
        shipment,
        driverId,
        evidenceUrl,
      });
    }

    if (result === "completed" && task.taskType === "deliver_empty_box") {
      const supabase = await createScopedSupabase(session);

      if (!supabase) {
        throw new Error("Supabase service role no configurado");
      }

      const view = await loadTruckInventoryView(session, driverId, task.routeId, taskScopeDate);
      const vehicleId = requireTruckVehicleId(view);
      const existingEvents = await loadTruckEvents(supabase, session, vehicleId);

      for (const boxLine of task.boxLines) {
        if (hasDeliverEventForTaskLine(existingEvents, task.id, boxLine)) {
          continue;
        }

        const line = findInventoryLine(view.summary, boxLine.key);
        const deliverError = validateConductorTruckDeliver(line, boxLine.quantity);

        if (deliverError) {
          return fail(deliverError);
        }
      }

      for (const boxLine of task.boxLines) {
        if (hasDeliverEventForTaskLine(existingEvents, task.id, boxLine)) {
          continue;
        }

        const line = findInventoryLine(view.summary, boxLine.key);

        if (line) {
          await insertTruckEvent(admin, session, {
            driverId,
            vehicleId,
            line,
            eventType: "deliver",
            qty: boxLine.quantity,
            taskId: task.id,
            shipmentId: task.shipmentId,
            routeId: task.routeId,
            note: formatConductorAdminActionNote(`Entrega - ${shipment.code}`, conductorActionAudit(session, driverId)),
          });
        }
      }
    }

    if (result === "completed" && task.taskType === "pickup_full_box") {
      const supabase = await createScopedSupabase(session);

      if (!supabase) {
        throw new Error("Supabase service role no configurado");
      }

      const view = await loadTruckInventoryView(session, driverId, task.routeId, taskScopeDate);
      const vehicleId = requireTruckVehicleId(view);
      const existingEvents = await loadTruckEvents(supabase, session, vehicleId);

      if (!task.routeId) {
        return fail("La recoleccion necesita una ruta activa");
      }

      for (const boxLine of task.boxLines) {
        if (hasPickupReturnEventForTaskLine(existingEvents, task.id, boxLine)) {
          continue;
        }

        await insertFullBoxCollectionEvent(admin, session, {
          driverId,
          vehicleId,
          taskId: task.id,
          shipmentId: task.shipmentId,
          routeId: task.routeId,
          warehouseId: task.warehouseId,
          boxLine,
          note: formatConductorAdminActionNote(
            `Caja llena recogida - ${shipment.code}`,
            conductorActionAudit(session, driverId),
          ),
        });
      }
    }

    await recordTaskAttempt(admin, session, {
      task,
      result,
      driverId,
      failureReason: result === "failed" ? failureReason : "",
      note,
      evidenceUrl,
      paymentExpectedAmount: hasDeliveryCollection ? expectedPaymentAmount : null,
      paymentAmount,
      paymentMethod: paymentOutcome === "collected" ? paymentMethod : "",
      paymentOutcome,
      invoiceVisible,
      clientOperationId,
      capturedAt,
    });

    if (result === "failed") {
      await failTask(admin, session, {
        task,
        shipment,
        driverId,
        failureReason: failureReason as ConductorTaskFailureReason,
        note,
        evidenceUrl,
      });
    } else {
      await completeTask(admin, session, {
        task,
        shipment,
        driverId,
        evidenceUrl,
        note,
        paymentExpectedAmount: expectedPaymentAmount,
        paymentAmount,
        paymentMethod,
        paymentOutcome,
      });
    }

    if (routeInfo?.route.id) {
      const now = new Date().toISOString();
      const { error: stopError } = await admin
        .from("logistics_route_stops")
        .update({
          outcome: result,
          outcome_at: now,
          updated_at: now,
        })
        .eq("route_id", routeInfo.route.id)
        .eq("task_id", task.id)
        .eq("organization_id", session.organizationId)
        .is("released_at", null);

      if (stopError) {
        throw new Error(stopError.message);
      }

      await tryAutoCompleteLogisticsRoute(admin, session, routeInfo.route.id);
    }

    revalidatePath("/conductor/tareas");
    revalidatePath("/conductor/inventario-camion");
    revalidatePath("/seguimiento");
    revalidatePath("/logistica");
    return ok({ taskId });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function reactivateConductorTaskAction(input: {
  taskId: string;
  driverId?: string | null;
}): Promise<ActionResult<{ taskId: string }>> {
  try {
    const session = await requireAppSession();

    if (!canWriteDriverTask(session)) {
      throw new Error("FORBIDDEN");
    }

    const admin = createSupabaseAdminClient();

    if (!admin) {
      return fail("Supabase service role no configurado");
    }

    const driverId = resolveConductorActionDriverId(session, input.driverId);
    const taskId = cleanText(input.taskId, 80);

    if (!taskId) {
      return fail("Falta tarea");
    }

    const taskRow = await loadDriverTaskFromDb(admin, session, taskId);

    if (!taskRow) {
      throw new Error("FORBIDDEN");
    }

    if (taskRow.status !== "cancelled") {
      return fail("Solo puedes reactivar visitas marcadas como no se pudo");
    }

    const { shipments, routes } = await loadConductorData(driverId);
    const routeByTaskId = buildRouteByTaskId(routes);
    const routeInfo = routeByTaskId.get(taskRow.id);

    if (
      !isTaskAssignedToDriver(
        { assignedTo: taskRow.assigned_to, status: taskRow.status },
        routeInfo,
        driverId,
        { includeClosed: true },
      )
    ) {
      throw new Error("FORBIDDEN");
    }

    if (
      !isConductorClosedTaskInScope(
        {
          status: taskRow.status,
          scheduledAt: taskRow.scheduled_at,
          assignedTo: taskRow.assigned_to,
        },
        routeInfo,
        conductorScopeDate(),
        driverId,
      )
    ) {
      return fail("La tarea ya no esta en tu jornada");
    }

    const shipment = shipments.find((entry) => entry.id === taskRow.shipment_id);

    if (!shipment) {
      return fail("Invoice no encontrado");
    }

    const now = new Date().toISOString();
    const scheduledAt = taskRow.scheduled_at;
    const assignedTo = taskRow.assigned_to;
    const nextStatus = scheduledAt ? "scheduled" : assignedTo ? "assigned" : "pending";
    const audit = conductorActionAudit(session, driverId);
    const reactivationNote = formatConductorAdminActionNote(
      "Devuelta al listado por conductor",
      audit,
    );

    const taskPatch: Record<string, unknown> = {
      status: nextStatus,
      notes: reactivationNote,
      updated_at: now,
      ...logisticsScheduleWindowPatch(scheduledAt),
      ...logisticsTaskReactivatePatchPreservingStock(
        { stockDeductedAt: taskRow.stock_deducted_at },
        now,
      ),
    };

    if (assignedTo) {
      Object.assign(
        taskPatch,
        logisticsTaskAssignedPatch(
          {
            orderedAt: now,
            assignedAt: null,
            loadedAt: null,
          },
          now,
        ),
      );
    }

    const { error: taskError } = await admin
      .from("shipment_logistics_tasks")
      .update(taskPatch)
      .eq("id", taskId)
      .eq("organization_id", session.organizationId);

    if (taskError) {
      throw new Error(taskError.message);
    }

    const { error: stopError } = await admin
      .from("logistics_route_stops")
      .update({
        outcome: null,
        outcome_at: null,
        updated_at: now,
      })
      .eq("task_id", taskId)
      .eq("organization_id", session.organizationId)
      .is("released_at", null);

    if (stopError) {
      throw new Error(stopError.message);
    }

    await admin
      .from("shipment_logistics_task_attempts")
      .update({
        resolved_at: now,
        resolved_by: session.userId,
        resolution: "reprogrammed",
        resolution_note: reactivationNote,
      })
      .eq("task_id", taskId)
      .eq("organization_id", session.organizationId)
      .eq("result", "failed")
      .is("resolved_at", null);

    await recordActivityHistory(admin, session, {
      action: "shipment.logistics_task_reactivated",
      entityType: "shipment",
      entityId: shipment.id,
      title: `Tarea reactivada: ${shipment.code}`,
      description: `${conductorTaskTypeLabel[taskRow.task_type]} · ${formatConductorAdminActorDescription(audit, "conductor")} la devolvio al listado`,
      metadata: {
        shipmentCode: shipment.code,
        source: "conductor.tareas",
        taskId,
        taskType: taskRow.task_type,
        status: nextStatus,
        driverId,
        ...conductorActionAuditMetadata(session, driverId),
      },
    });

    revalidatePath("/conductor/tareas");
    revalidatePath("/conductor/inventario-camion");
    revalidatePath("/seguimiento");
    revalidatePath("/logistica");
    return ok({ taskId });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
