"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  listLogisticsRoutesAction,
  listLogisticsTaskAddressesAction,
} from "@/app/actions/logistics-routes";
import {
  listShipmentsForRouteBoardAction,
  type ShipmentRow,
} from "@/app/actions/shipments";
import { canPreviewConductorTasks } from "@/lib/conductor-tareas-view";
import {
  buildConductorDriverTasks,
  conductorTaskTypeLabel,
  type ConductorDriverTask,
} from "@/lib/conductor-tasks";
import {
  buildConductorTruckInventory,
  LOGISTICS_TASK_EVIDENCE_BUCKET,
  validateConductorTruckLoad,
  validateConductorTruckReturn,
  validateConductorTaskResultInput,
  type ConductorTaskFailureReason,
  type ConductorTruckInventoryEvent,
  type ConductorTruckInventoryLine,
  type ConductorTruckInventorySummary,
  type ConductorTruckStockItem,
} from "@/lib/conductor-truck-inventory";
import { requireAppSession } from "@/lib/auth/session";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import { recordActivityHistory } from "@/lib/activity-history";
import { formatMoneyValue, parseMoneyValue } from "@/lib/logistics-fees";
import { readBillingFromPlan } from "@/lib/invoice-billing";
import {
  DEFAULT_PAYMENT_METHOD,
  isPaymentMethod,
  paymentMethodLabel,
  type PaymentMethod,
} from "@/lib/payment-methods";
import { quoteFromShipment, balanceDueFromShipment, syncShipmentStatusPatch } from "@/lib/shipment-display";
import {
  buildFirstMilestonePatch,
  milestoneKeyForLogisticsTask,
  readShipmentMilestones,
} from "@/lib/shipment-milestones";
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

export type ConductorTruckInventoryView = {
  driverId: string;
  summary: ConductorTruckInventorySummary;
};

const EVIDENCE_MAX_BYTES = 8 * 1024 * 1024;
const EVIDENCE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function canWriteDriverTask(session: AppSession) {
  return sessionHasPermission(session, "routes.update_status");
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

function resolveDriverId(session: AppSession, requestedDriverId?: string | null) {
  const requested = cleanText(requestedDriverId, 80);

  if (canPreviewConductorTasks(session.roleSlug)) {
    return requested || session.userId;
  }

  return session.userId;
}

async function loadConductorData(driverId: string) {
  const [shipmentsResult, routesResult, addressesResult] = await Promise.all([
    listShipmentsForRouteBoardAction(),
    listLogisticsRoutesAction(),
    listLogisticsTaskAddressesAction(),
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
    tasks: buildConductorDriverTasks({
      shipments: shipmentsResult.data,
      routes: routesResult.data,
      taskAddresses: addressesResult.data,
      driverId,
    }),
  };
}

async function loadTruckEvents(supabase: Supabase, session: AppSession, driverId: string) {
  const { data, error } = await supabase
    .from("logistics_truck_inventory_events")
    .select(
      "id, event_type, route_id, task_id, shipment_id, warehouse_id, item_id, item_name, catalog_key, item_label, qty, created_at",
    )
    .eq("organization_id", session.organizationId)
    .eq("assigned_driver_id", driverId)
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

async function loadTruckInventoryView(
  session: AppSession,
  driverId: string,
): Promise<ConductorTruckInventoryView> {
  const supabase = await createScopedSupabase(session);
  const admin = createSupabaseAdminClient();

  if (!supabase || !admin) {
    throw new Error("Supabase service role no configurado");
  }

  const [{ tasks }, events, stock] = await Promise.all([
    loadConductorData(driverId),
    loadTruckEvents(supabase, session, driverId),
    loadTruckStock(admin, session),
  ]);

  return {
    driverId,
    summary: buildConductorTruckInventory({ tasks, events, stock }),
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

async function decrementWarehouseStock(admin: Admin, session: AppSession, line: ConductorTruckInventoryLine, qty: number) {
  requireLineStock(line);

  const { data: current, error: loadError } = await admin
    .from("inventory_stock")
    .select("id, stock")
    .eq("organization_id", session.organizationId)
    .eq("warehouse_id", line.warehouseId)
    .eq("item_id", line.itemId)
    .maybeSingle();

  if (loadError || !current) {
    throw new Error(loadError?.message || `Stock no encontrado para ${line.label}`);
  }

  const currentStock = Number(current.stock) || 0;

  if (currentStock < qty) {
    throw new Error(`Stock insuficiente para ${line.label}`);
  }

  const { error } = await admin
    .from("inventory_stock")
    .update({ stock: currentStock - qty })
    .eq("id", current.id)
    .eq("organization_id", session.organizationId);

  if (error) {
    throw new Error(error.message);
  }
}

async function incrementWarehouseStock(admin: Admin, session: AppSession, line: ConductorTruckInventoryLine, qty: number) {
  requireLineStock(line);

  const { data: current, error: loadError } = await admin
    .from("inventory_stock")
    .select("id, stock")
    .eq("organization_id", session.organizationId)
    .eq("warehouse_id", line.warehouseId)
    .eq("item_id", line.itemId)
    .maybeSingle();

  if (loadError || !current) {
    throw new Error(loadError?.message || `Stock no encontrado para ${line.label}`);
  }

  const { error } = await admin
    .from("inventory_stock")
    .update({ stock: (Number(current.stock) || 0) + qty })
    .eq("id", current.id)
    .eq("organization_id", session.organizationId);

  if (error) {
    throw new Error(error.message);
  }
}

async function insertInventoryMovement(admin: Admin, session: AppSession, input: {
  line: ConductorTruckInventoryLine;
  type: "salida" | "devolucion";
  qty: number;
  note: string;
  driverId: string;
}) {
  requireLineStock(input.line);

  const { error } = await admin.from("inventory_movements").insert({
    organization_id: session.organizationId,
    warehouse_id: input.line.warehouseId,
    item_id: input.line.itemId,
    item_name: input.line.itemName || input.line.label,
    type: input.type,
    qty: input.qty,
    note: input.note,
    created_by: session.userId,
    assignee_id: input.driverId,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function insertTruckEvent(admin: Admin, session: AppSession, input: {
  driverId: string;
  line: ConductorTruckInventoryLine;
  eventType: "load" | "deliver" | "return";
  qty: number;
  taskId?: string | null;
  shipmentId?: string | null;
  routeId?: string | null;
  note?: string;
}) {
  const { error } = await admin.from("logistics_truck_inventory_events").insert({
    organization_id: session.organizationId,
    assigned_driver_id: input.driverId,
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
    throw new Error(error.message);
  }
}

async function uploadEvidence(admin: Admin, session: AppSession, taskId: string, file: File | null) {
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
  const path = `${session.organizationId}/${taskId}/${randomUUID()}.${extension}`;
  const { error } = await admin.storage.from(LOGISTICS_TASK_EVIDENCE_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = admin.storage.from(LOGISTICS_TASK_EVIDENCE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function collectDriverPayment(admin: Admin, session: AppSession, shipment: ShipmentRow, input: {
  amount: number;
  method: PaymentMethod;
  note: string;
}) {
  if (input.amount <= 0) {
    return;
  }

  const quote = quoteFromShipment(shipment);
  const billing = readBillingFromPlan(shipment.logistics_plan);
  const balanceDue = balanceDueFromShipment(shipment, quote);

  if (input.amount > balanceDue) {
    throw new Error(`El monto no puede superar ${formatMoneyValue(balanceDue)}`);
  }

  const quotedTotal = billing
    ? parseMoneyValue(billing.quotedTotal)
    : parseMoneyValue(quote?.total || String(shipment.paid + balanceDue));
  const cost = billing
    ? parseMoneyValue(billing.boxSubtotalBeforeDiscount) - parseMoneyValue(billing.promotionDiscount)
    : parseMoneyValue(quote?.cost || "$0");
  const paid = shipment.paid + input.amount;
  const isFullPayment = paid >= quotedTotal;
  const nextBalanceDue = Math.max(quotedTotal - paid, 0);
  const nextPlan = {
    ...shipment.logistics_plan,
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

  const { error } = await admin.rpc("collect_shipment_invoice_payment", {
    target_shipment_id: shipment.id,
    target_organization_id: session.organizationId,
    next_paid: paid,
    next_profit: isFullPayment ? Math.max(paid - cost, 0) : shipment.profit,
    next_sale_kind: shipment.sale_kind,
    next_invoice_status: isFullPayment ? "paid" : "open",
    next_accounting_status: isFullPayment ? "exportable" : shipment.accounting_status,
    next_finalized_at: isFullPayment ? new Date().toISOString() : shipment.finalized_at,
    next_logistics_plan: nextPlan,
    payment_amount: input.amount,
    payment_method: input.method,
    payment_kind: "balance",
    payment_note: input.note,
    payment_created_by: session.userId,
  });

  if (error) {
    throw new Error(error.message);
  }

  await recordActivityHistory(admin, session, {
    action: isFullPayment ? "sale.invoice_finalized" : "sale.invoice_partial_payment",
    entityType: "shipment",
    entityId: shipment.id,
    title: isFullPayment ? `Invoice cobrado: ${shipment.code}` : `Abono registrado: ${shipment.code}`,
    description: `${shipment.customer_name} - conductor cobro ${formatMoneyValue(input.amount)} - ${paymentMethodLabel(input.method)}`,
    metadata: {
      shipmentCode: shipment.code,
      source: "conductor.tareas",
      collectAmount: input.amount,
      paid,
      balanceDue: nextBalanceDue,
      paymentMethod: input.method,
      paymentMethodLabel: paymentMethodLabel(input.method),
      paymentNote: input.note,
    },
  });
}

async function recordTaskAttempt(admin: Admin, session: AppSession, input: {
  task: ConductorDriverTask;
  result: "completed" | "failed";
  driverId: string;
  failureReason: string;
  note: string;
  evidenceUrl: string;
  paymentAmount: number;
  paymentMethod: PaymentMethod | "";
}) {
  const { error } = await admin.from("shipment_logistics_task_attempts").insert({
    organization_id: session.organizationId,
    shipment_id: input.task.shipmentId,
    task_id: input.task.id,
    route_id: input.task.routeId,
    driver_id: input.driverId,
    result: input.result,
    failure_reason: input.failureReason,
    note: input.note,
    evidence_url: input.evidenceUrl,
    payment_amount: input.paymentAmount > 0 ? input.paymentAmount : null,
    payment_method: input.paymentMethod || null,
    created_by: session.userId,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function completeTask(admin: Admin, session: AppSession, input: {
  task: ConductorDriverTask;
  shipment: ShipmentRow;
  driverId: string;
  evidenceUrl: string;
  note: string;
  paymentAmount: number;
  paymentMethod: PaymentMethod;
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

  const taskPatch: Record<string, string | null> = {
    status: "completed",
    completed_at: now,
    notes: input.note || null,
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

  if (Object.keys(milestonePatch).length || statusPatch.status) {
    const { error: shipmentError } = await admin
      .from("shipments")
      .update({ ...milestonePatch, ...statusPatch })
      .eq("id", input.shipment.id)
      .eq("organization_id", session.organizationId);

    if (shipmentError) {
      throw new Error(shipmentError.message);
    }
  }

  await collectDriverPayment(admin, session, input.shipment, {
    amount: input.paymentAmount,
    method: input.paymentMethod,
    note: input.note,
  });

  await recordActivityHistory(admin, session, {
    action: "shipment.logistics_task_updated",
    entityType: "shipment",
    entityId: input.shipment.id,
    title: `Tarea logistica: completed`,
    description: `${input.shipment.code} - ${conductorTaskTypeLabel[input.task.taskType]} - conductor completo`,
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
      paymentAmount: input.paymentAmount,
      paymentMethod: input.paymentAmount > 0 ? input.paymentMethod : null,
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
  const fullNote = [input.failureReason, input.note].filter(Boolean).join(" - ");

  const { error: taskError } = await admin
    .from("shipment_logistics_tasks")
    .update({
      status: "cancelled",
      notes: fullNote,
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
    note: fullNote,
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
    description: `Conductor: ${fullNote}`,
    metadata: {
      shipmentCode: input.shipment.code,
      source: "conductor.tareas",
      taskId: input.task.id,
      taskType: input.task.taskType,
      failureReason: input.failureReason,
      evidenceUrl: input.evidenceUrl,
    },
  });

  await recordActivityHistory(admin, session, {
    action: "shipment.logistics_task_failed",
    entityType: "shipment",
    entityId: input.shipment.id,
    title: `Tarea cancelada: ${input.shipment.code}`,
    description: `${conductorTaskTypeLabel[input.task.taskType]} - ${fullNote}`,
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

export async function getConductorTruckInventoryAction(
  driverId?: string | null,
): Promise<ActionResult<ConductorTruckInventoryView>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "routes.view")) {
      throw new Error("FORBIDDEN");
    }

    const effectiveDriverId = resolveDriverId(session, driverId);
    return ok(await loadTruckInventoryView(session, effectiveDriverId));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function loadConductorTruckLineAction(input: {
  driverId?: string | null;
  lineKey: string;
  qty?: number;
}): Promise<ActionResult<ConductorTruckInventoryView>> {
  try {
    const session = await requireAppSession();

    if (!canWriteDriverTask(session)) {
      throw new Error("FORBIDDEN");
    }

    const driverId = resolveDriverId(session, input.driverId);
    const admin = createSupabaseAdminClient();

    if (!admin) {
      return fail("Supabase service role no configurado");
    }

    const view = await loadTruckInventoryView(session, driverId);
    const line = findInventoryLine(view.summary, input.lineKey);

    if (!line) {
      return fail("Caja no encontrada");
    }

    const qty = Math.max(Math.floor(Number(input.qty) || line.shortageQty), 1);

    const validationError = validateConductorTruckLoad(line, qty);

    if (validationError) {
      return fail(validationError);
    }

    await decrementWarehouseStock(admin, session, line, qty);
    await insertInventoryMovement(admin, session, {
      line,
      type: "salida",
      qty,
      note: `Carga camion - ${line.label}`,
      driverId,
    });
    await insertTruckEvent(admin, session, {
      driverId,
      line,
      eventType: "load",
      qty,
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
      },
    });

    revalidatePath("/conductor/inventario-camion");
    revalidatePath("/conductor/tareas");
    return ok(await loadTruckInventoryView(session, driverId));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function returnConductorTruckLineAction(input: {
  driverId?: string | null;
  lineKey: string;
  qty?: number;
}): Promise<ActionResult<ConductorTruckInventoryView>> {
  try {
    const session = await requireAppSession();

    if (!canWriteDriverTask(session)) {
      throw new Error("FORBIDDEN");
    }

    const driverId = resolveDriverId(session, input.driverId);
    const admin = createSupabaseAdminClient();

    if (!admin) {
      return fail("Supabase service role no configurado");
    }

    const view = await loadTruckInventoryView(session, driverId);
    const line = findInventoryLine(view.summary, input.lineKey);

    if (!line) {
      return fail("Caja no encontrada");
    }

    const qty = Math.max(Math.floor(Number(input.qty) || line.currentQty), 1);

    const validationError = validateConductorTruckReturn(line, qty);

    if (validationError) {
      return fail(validationError);
    }

    await incrementWarehouseStock(admin, session, line, qty);
    await insertInventoryMovement(admin, session, {
      line,
      type: "devolucion",
      qty,
      note: `Devolucion camion - ${line.label}`,
      driverId,
    });
    await insertTruckEvent(admin, session, {
      driverId,
      line,
      eventType: "return",
      qty,
      note: `Devolucion camion - ${line.label}`,
    });

    await recordActivityHistory(admin, session, {
      action: "logistics.truck_inventory_returned",
      entityType: "profile",
      entityId: driverId,
      title: `Camion devuelto`,
      description: `${qty} - ${line.label}`,
      metadata: {
        source: "conductor.inventario_camion",
        driverId,
        lineKey: line.key,
        qty,
        label: line.label,
      },
    });

    revalidatePath("/conductor/inventario-camion");
    revalidatePath("/conductor/tareas");
    return ok(await loadTruckInventoryView(session, driverId));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function startConductorRouteAction(
  driverId?: string | null,
): Promise<ActionResult<ConductorTruckInventoryView>> {
  try {
    const session = await requireAppSession();

    if (!canWriteDriverTask(session)) {
      throw new Error("FORBIDDEN");
    }

    const effectiveDriverId = resolveDriverId(session, driverId);
    const admin = createSupabaseAdminClient();

    if (!admin) {
      return fail("Supabase service role no configurado");
    }

    const view = await loadTruckInventoryView(session, effectiveDriverId);

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

    await recordActivityHistory(admin, session, {
      action: "logistics.route_started",
      entityType: "profile",
      entityId: effectiveDriverId,
      title: "Ruta iniciada",
      description: `${view.summary.currentTotal} cajas en camion`,
      metadata: {
        source: "conductor.inventario_camion",
        driverId: effectiveDriverId,
        taskIds,
        lines: view.summary.lines.map((line) => ({
          label: line.label,
          currentQty: line.currentQty,
          requiredQty: line.requiredQty,
        })),
      },
    });

    revalidatePath("/conductor/inventario-camion");
    revalidatePath("/conductor/tareas");
    return ok(await loadTruckInventoryView(session, effectiveDriverId));
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

    const driverId = session.userId;
    const taskId = cleanText(formData.get("taskId"), 80);
    const result = cleanText(formData.get("result"), 20) === "failed" ? "failed" : "completed";
    const failureReason = cleanText(formData.get("failureReason"), 120);
    const note = cleanText(formData.get("note"), 1000);
    const paymentAmount = Math.max(parseMoneyValue(cleanText(formData.get("paymentAmount"), 40)), 0);
    const paymentMethod = readPaymentMethod(formData.get("paymentMethod"));
    const evidence = formData.get("evidence");
    const evidenceFile = evidence instanceof File && evidence.name ? evidence : null;

    if (!taskId) {
      return fail("Falta tarea");
    }

    const { tasks, shipments } = await loadConductorData(driverId);
    const task = tasks.find((entry) => entry.id === taskId);

    if (!task) {
      throw new Error("FORBIDDEN");
    }

    const validationError = validateConductorTaskResultInput({
      result,
      taskType: task.taskType,
      failureReason,
      evidenceFileName: evidenceFile?.name,
      paymentAmount,
    });

    if (validationError) {
      return fail(validationError);
    }

    const shipment = shipments.find((entry) => entry.id === task.shipmentId);

    if (!shipment) {
      return fail("Invoice no encontrado");
    }

    const evidenceUrl = await uploadEvidence(admin, session, task.id, evidenceFile);

    if (result === "completed" && task.taskType === "deliver_empty_box") {
      const view = await loadTruckInventoryView(session, driverId);

      for (const boxLine of task.boxLines) {
        const line = findInventoryLine(view.summary, boxLine.key);

        if (!line || line.currentQty < boxLine.quantity) {
          return fail(`Faltan cajas en camion para ${boxLine.label}`);
        }
      }

      for (const boxLine of task.boxLines) {
        const line = findInventoryLine(view.summary, boxLine.key);

        if (line) {
          await insertTruckEvent(admin, session, {
            driverId,
            line,
            eventType: "deliver",
            qty: boxLine.quantity,
            taskId: task.id,
            shipmentId: task.shipmentId,
            routeId: task.routeId,
            note: `Entrega - ${shipment.code}`,
          });
        }
      }
    }

    await recordTaskAttempt(admin, session, {
      task,
      result,
      driverId,
      failureReason: result === "failed" ? failureReason : "",
      note,
      evidenceUrl,
      paymentAmount: result === "completed" ? paymentAmount : 0,
      paymentMethod: result === "completed" && paymentAmount > 0 ? paymentMethod : "",
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
        paymentAmount,
        paymentMethod,
      });
    }

    revalidatePath("/conductor/tareas");
    revalidatePath("/conductor/inventario-camion");
    revalidatePath("/envios");
    return ok({ taskId });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
