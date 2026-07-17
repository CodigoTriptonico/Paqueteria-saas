import { catalogKeyFromStockItem } from "@/lib/pricing-catalog";
import { normalizeInventoryText } from "@/lib/inventory-tree";
import { formatScheduleDateInput } from "@/lib/schedule-date";

export const LOGISTICS_TASK_EVIDENCE_BUCKET = "logistics-task-evidence";

export const CONDUCTOR_TASK_FAILURE_REASONS = [
  "Cliente no contesto",
  "No abrio puerta",
  "Direccion incorrecta",
  "Calle o acceso cerrado",
  "Cliente cancelo",
  "Caja no lista",
  "Invoice no visible",
  "Problema de ruta",
  "Otra",
] as const;

export type ConductorTaskFailureReason = (typeof CONDUCTOR_TASK_FAILURE_REASONS)[number];

export const CONDUCTOR_TRUCK_RETURN_REASONS = [
  "Sobro carga",
  "Caja danada",
  "Error al subir",
  "Ruta reprogramada",
  "Fin de jornada",
  "Cambio de vehiculo",
  "Otra",
] as const;

type ConductorTruckReturnReason = (typeof CONDUCTOR_TRUCK_RETURN_REASONS)[number];

const CONDUCTOR_TRUCK_VEHICLE_CHANGE_REASON: ConductorTruckReturnReason = "Cambio de vehiculo";

export type ConductorTransferVehicleOption = {
  id: string;
  label: string;
};

export type ConductorTruckEventType =
  | "load"
  | "deliver"
  | "return"
  | "adjust"
  | "collect_full_box"
  | "unload_full_box";

export type ConductorTruckBoxLine = {
  key: string;
  catalogKey: string;
  label: string;
  quantity: number;
};

export type ConductorTruckTaskInput = {
  id: string;
  shipmentId: string;
  routeId: string | null;
  routeName: string | null;
  routeDate: string | null;
  taskType: "deliver_empty_box" | "pickup_full_box";
  status: string;
  warehouseId: string | null;
  boxLines: ConductorTruckBoxLine[];
};

export type ConductorTruckInventoryEvent = {
  id?: string;
  eventType: ConductorTruckEventType;
  routeId: string | null;
  taskId: string | null;
  shipmentId: string | null;
  warehouseId: string | null;
  itemId: string | null;
  itemName: string;
  catalogKey: string;
  itemLabel: string;
  qty: number;
  createdAt?: string;
};

export type ConductorTruckStockItem = {
  itemId: string;
  itemName: string;
  category: string;
  kind: string;
  subcategory?: string;
  warehouseId: string;
  stock: number;
};

export type ConductorTruckInventoryLine = {
  key: string;
  catalogKey: string;
  label: string;
  requiredQty: number;
  loadedQty: number;
  deliveredQty: number;
  returnedQty: number;
  currentQty: number;
  shortageQty: number;
  stockQty: number;
  itemId: string | null;
  itemName: string;
  warehouseId: string | null;
  taskIds: string[];
  routeIds: string[];
};

export type ConductorTruckInventoryScope = {
  date: string;
  routeIds: string[];
  taskIds: string[];
};

export type ConductorTruckInventorySummary = {
  lines: ConductorTruckInventoryLine[];
  requiredTotal: number;
  loadedTotal: number;
  deliveredTotal: number;
  currentTotal: number;
  shortageTotal: number;
  ready: boolean;
};

export type ConductorTruckOnTruckLine = {
  key: string;
  lineKey: string;
  label: string;
  qty: number;
  maxReturnQty: number;
  itemId: string | null;
  warehouseId: string | null;
  catalogKey: string;
  origin: "route" | "extra";
};

export function splitTruckLineOnTruckQty(
  line: Pick<ConductorTruckInventoryLine, "requiredQty" | "deliveredQty" | "currentQty">,
) {
  if (line.currentQty <= 0) {
    return { routeQty: 0, extraQty: 0 };
  }

  const routeNeedRemaining = Math.max(line.requiredQty - line.deliveredQty, 0);
  const routeQty =
    line.requiredQty > 0 ? Math.min(line.currentQty, routeNeedRemaining) : 0;
  const extraQty = Math.max(line.currentQty - routeQty, 0);

  return { routeQty, extraQty };
}

function buildOnTruckLine(
  line: ConductorTruckInventoryLine,
  qty: number,
  origin: "route" | "extra",
): ConductorTruckOnTruckLine | null {
  if (qty <= 0) {
    return null;
  }

  return {
    key: `${origin}:${line.key}`,
    lineKey: line.key,
    label: line.label,
    qty,
    maxReturnQty: qty,
    itemId: line.itemId,
    warehouseId: line.warehouseId,
    catalogKey: line.catalogKey,
    origin,
  };
}

export function buildRouteBoxesOnTruck(
  lines: ReadonlyArray<ConductorTruckInventoryLine>,
): ConductorTruckOnTruckLine[] {
  return lines
    .map((line) => {
      const { routeQty } = splitTruckLineOnTruckQty(line);
      return buildOnTruckLine(line, routeQty, "route");
    })
    .filter((line): line is ConductorTruckOnTruckLine => Boolean(line))
    .sort((left, right) => left.label.localeCompare(right.label, "es"));
}

export type ConductorRouteDeliveryBoardLine = {
  key: string;
  label: string;
  requiredQty: number;
  onTruckQty: number;
  pendingQty: number;
  line: ConductorTruckInventoryLine;
};

export function buildRouteDeliveryBoard(
  lines: ReadonlyArray<ConductorTruckInventoryLine>,
): ConductorRouteDeliveryBoardLine[] {
  return lines
    .filter((line) => line.requiredQty > 0)
    .map((line) => {
      const { routeQty } = splitTruckLineOnTruckQty(line);
      return {
        key: line.key,
        label: line.label,
        requiredQty: line.requiredQty,
        onTruckQty: routeQty,
        pendingQty: line.shortageQty,
        line,
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label, "es"));
}

export function sumRouteDeliveryOnTruck(lines: ReadonlyArray<ConductorRouteDeliveryBoardLine>) {
  return lines.reduce((sum, line) => sum + line.onTruckQty, 0);
}

export function sumRouteDeliveryPending(lines: ReadonlyArray<ConductorRouteDeliveryBoardLine>) {
  return lines.reduce((sum, line) => sum + line.pendingQty, 0);
}

export function buildExtraBoxesOnTruck(
  lines: ReadonlyArray<ConductorTruckInventoryLine>,
): ConductorTruckOnTruckLine[] {
  return lines
    .map((line) => {
      const { extraQty } = splitTruckLineOnTruckQty(line);
      return buildOnTruckLine(line, extraQty, "extra");
    })
    .filter((line): line is ConductorTruckOnTruckLine => Boolean(line))
    .sort((left, right) => left.label.localeCompare(right.label, "es"));
}

export function sumOnTruckLines(lines: ReadonlyArray<ConductorTruckOnTruckLine>) {
  return lines.reduce((sum, line) => sum + line.qty, 0);
}

export type ConductorTruckBalance = {
  vehicleId: string;
  vehicleName: string;
  vehiclePlate: string;
  assignedDriverId: string | null;
  assignedDriverName: string;
  lines: ConductorTruckInventoryLine[];
  totalQty: number;
};

type ConductorFullBoxCargoLine = {
  key: string;
  taskId: string;
  shipmentId: string | null;
  routeId: string | null;
  label: string;
  collectedQty: number;
  unloadedQty: number;
  pendingQty: number;
};

export type ConductorFullBoxCargoSummary = {
  lines: ConductorFullBoxCargoLine[];
  collectedTotal: number;
  unloadedTotal: number;
  pendingTotal: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function cleanLabel(value: unknown, fallback = "Caja") {
  return String(value || fallback).trim() || fallback;
}

function positiveQuantity(value: unknown) {
  return Math.max(Math.floor(Number(value) || 1), 1);
}

export function conductorTruckLineKey(input: { catalogKey?: string; label: string }) {
  const catalogKey = String(input.catalogKey || "").trim();
  return catalogKey ? `catalog:${normalizeInventoryText(catalogKey)}` : `label:${normalizeInventoryText(input.label)}`;
}

export function readConductorTruckBoxLinesFromPlan(planValue: unknown): ConductorTruckBoxLine[] {
  const plan = asRecord(planValue);
  const rawLines = Array.isArray(plan.boxLines) ? plan.boxLines : [];
  const lines = rawLines
    .map((entry) => {
      const row = asRecord(entry);
      const label = cleanLabel(row.label, "");

      if (!label) {
        return null;
      }

      const catalogKey = String(row.catalogKey || "").trim();
      return {
        key: conductorTruckLineKey({ catalogKey, label }),
        catalogKey,
        label,
        quantity: positiveQuantity(row.quantity),
      } satisfies ConductorTruckBoxLine;
    })
    .filter((line): line is ConductorTruckBoxLine => Boolean(line));

  if (lines.length) {
    return lines;
  }

  const box = asRecord(plan.box);
  const label = cleanLabel(box.label, "");

  if (!label) {
    return [];
  }

  const catalogKey = String(box.catalogKey || "").trim();
  return [
    {
      key: conductorTruckLineKey({ catalogKey, label }),
      catalogKey,
      label,
      quantity: positiveQuantity(plan.boxCount),
    },
  ];
}

export function conductorTruckStockCatalogKey(item: ConductorTruckStockItem) {
  return catalogKeyFromStockItem({
    category: item.category,
    kind: item.kind,
    subcategory: item.subcategory,
  });
}

function findStockForTruckLine(
  line: Pick<ConductorTruckInventoryLine, "catalogKey" | "label" | "warehouseId">,
  stock: ReadonlyArray<ConductorTruckStockItem>,
) {
  const catalogKey = normalizeInventoryText(line.catalogKey || "");
  const label = normalizeInventoryText(line.label);
  const warehouseStock = line.warehouseId
    ? stock.filter((item) => item.warehouseId === line.warehouseId)
    : [];
  const candidates = warehouseStock.length ? warehouseStock : stock;

  if (catalogKey) {
    const exact = candidates.find((item) => normalizeInventoryText(conductorTruckStockCatalogKey(item)) === catalogKey);
    if (exact) {
      return exact;
    }
  }

  return candidates.find((item) => {
    const values = [
      item.itemName,
      item.kind,
      item.subcategory || "",
      `Caja ${item.itemName}`,
      `Caja ${item.kind}`,
    ].map(normalizeInventoryText);

    return values.some((value) => value && (value.includes(label) || label.includes(value)));
  }) || null;
}

function eventKey(event: Pick<ConductorTruckInventoryEvent, "catalogKey" | "itemLabel" | "itemName">) {
  return conductorTruckLineKey({
    catalogKey: event.catalogKey,
    label: event.itemLabel || event.itemName,
  });
}

function conductorTruckBoxLineIdentity(catalogKey: string, itemLabel: string) {
  return conductorTruckLineKey({ catalogKey, label: itemLabel });
}

function eventCreatedAtScopeDate(createdAt?: string) {
  if (!createdAt) {
    return null;
  }

  const parsed = new Date(createdAt);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return formatScheduleDateInput(parsed);
}

export function buildConductorTruckInventoryScope(
  tasks: ReadonlyArray<ConductorTruckTaskInput>,
  scopeDate: string,
): ConductorTruckInventoryScope {
  const taskIds: string[] = [];
  const routeIds: string[] = [];

  for (const task of tasks) {
    if (!isOpenTruckDeliveryTask(task)) {
      continue;
    }

    if (!taskIds.includes(task.id)) {
      taskIds.push(task.id);
    }

    if (task.routeId && !routeIds.includes(task.routeId)) {
      routeIds.push(task.routeId);
    }
  }

  return {
    date: scopeDate,
    taskIds,
    routeIds,
  };
}

/** Directly assigned deliveries also need to travel in the driver's truck. */
export function conductorTruckLoadTasks(
  tasks: ReadonlyArray<ConductorTruckTaskInput>,
  selectedRouteId: string | null,
) {
  return tasks.filter(
    (task) =>
      isOpenTruckDeliveryTask(task) &&
      (!task.routeId || task.routeId === selectedRouteId),
  );
}

export function isConductorTruckEventInScope(
  event: ConductorTruckInventoryEvent,
  scope: ConductorTruckInventoryScope,
) {
  if (
    !event.taskId &&
    (event.eventType === "load" || event.eventType === "return")
  ) {
    return eventCreatedAtScopeDate(event.createdAt) === scope.date;
  }

  if (event.taskId && scope.taskIds.includes(event.taskId)) {
    return true;
  }

  if (event.routeId && scope.routeIds.includes(event.routeId)) {
    return true;
  }

  if (!event.taskId && !event.routeId) {
    return eventCreatedAtScopeDate(event.createdAt) === scope.date;
  }

  return false;
}

export function hasDeliverEventForTaskLine(
  events: ReadonlyArray<ConductorTruckInventoryEvent>,
  taskId: string,
  boxLine: Pick<ConductorTruckBoxLine, "catalogKey" | "label">,
) {
  const identity = conductorTruckBoxLineIdentity(boxLine.catalogKey, boxLine.label);

  return events.some(
    (event) =>
      event.eventType === "deliver" &&
      event.taskId === taskId &&
      eventKey(event) === identity,
  );
}

export function hasPickupReturnEventForTaskLine(
  events: ReadonlyArray<ConductorTruckInventoryEvent>,
  taskId: string,
  boxLine: Pick<ConductorTruckBoxLine, "catalogKey" | "label">,
) {
  const identity = conductorTruckBoxLineIdentity(boxLine.catalogKey, boxLine.label);

  return events.some(
    (event) =>
      (event.eventType === "collect_full_box" ||
        event.eventType === "unload_full_box" ||
        event.eventType === "return") &&
      event.taskId === taskId &&
      eventKey(event) === identity,
  );
}


function eventDelta(event: ConductorTruckInventoryEvent) {
  const qty = Number(event.qty) || 0;

  if (event.eventType === "load") {
    return qty;
  }

  if (event.eventType === "adjust") {
    return qty;
  }

  return -Math.abs(qty);
}

function isOpenTruckDeliveryTask(task: Pick<ConductorTruckTaskInput, "taskType" | "status">) {
  return (
    task.taskType === "deliver_empty_box" &&
    task.status !== "completed" &&
    task.status !== "cancelled"
  );
}

export function buildConductorTruckInventory(input: {
  tasks: ReadonlyArray<ConductorTruckTaskInput>;
  events: ReadonlyArray<ConductorTruckInventoryEvent>;
  stock: ReadonlyArray<ConductorTruckStockItem>;
  scope?: ConductorTruckInventoryScope;
  includePersistentEvents?: boolean;
}): ConductorTruckInventorySummary {
  const requirements = new Map<string, ConductorTruckInventoryLine>();
  const scopedEvents = input.includePersistentEvents
    ? input.events
    : input.scope
    ? input.events.filter((event) => isConductorTruckEventInScope(event, input.scope!))
    : input.events;

  for (const task of input.tasks) {
    if (!isOpenTruckDeliveryTask(task)) {
      continue;
    }

    for (const boxLine of task.boxLines) {
      const current = requirements.get(boxLine.key);
      const next = current || {
        key: boxLine.key,
        catalogKey: boxLine.catalogKey,
        label: boxLine.label,
        requiredQty: 0,
        loadedQty: 0,
        deliveredQty: 0,
        returnedQty: 0,
        currentQty: 0,
        shortageQty: 0,
        stockQty: 0,
        itemId: null,
        itemName: "",
        warehouseId: task.warehouseId,
        taskIds: [],
        routeIds: [],
      };

      next.requiredQty += boxLine.quantity;

      if (!next.taskIds.includes(task.id)) {
        next.taskIds.push(task.id);
      }

      if (task.routeId && !next.routeIds.includes(task.routeId)) {
        next.routeIds.push(task.routeId);
      }

      requirements.set(boxLine.key, next);
    }
  }

  for (const event of scopedEvents) {
    if (
      input.includePersistentEvents &&
      (event.eventType === "load" ||
        event.eventType === "deliver" ||
        event.eventType === "return" ||
        event.eventType === "adjust")
    ) {
      const key = eventKey(event);

      if (!requirements.has(key)) {
        requirements.set(key, {
          key,
          catalogKey: event.catalogKey,
          label: event.itemLabel || event.itemName || "Caja",
          requiredQty: 0,
          loadedQty: 0,
          deliveredQty: 0,
          returnedQty: 0,
          currentQty: 0,
          shortageQty: 0,
          stockQty: 0,
          itemId: event.itemId,
          itemName: event.itemName || event.itemLabel || "Caja",
          warehouseId: event.warehouseId,
          taskIds: [],
          routeIds: event.routeId ? [event.routeId] : [],
        });
      }
    }

    if (
      event.eventType !== "load" &&
      event.eventType !== "deliver" &&
      event.eventType !== "return" &&
      event.eventType !== "adjust"
    ) {
      continue;
    }

    const key = eventKey(event);
    const line = requirements.get(key);

    if (!line) {
      continue;
    }

    const qty = Math.abs(Number(event.qty) || 0);

    if (event.eventType === "load") {
      line.loadedQty += qty;
    } else if (event.eventType === "deliver") {
      line.deliveredQty += qty;
    } else if (event.eventType === "return") {
      line.returnedQty += qty;
    }

    line.currentQty += eventDelta(event);
  }

  const lines = [...requirements.values()]
    .map((line) => {
      const stock = findStockForTruckLine(line, input.stock);
      const stockQty = Math.max(Number(stock?.stock) || 0, 0);
      const currentQty = Math.max(Math.round(line.currentQty * 100) / 100, 0);
      const shortageQty = Math.max(line.requiredQty - currentQty, 0);

      return {
        ...line,
        currentQty,
        shortageQty,
        stockQty,
        itemId: stock?.itemId || line.itemId || null,
        itemName: stock?.itemName || line.itemName || line.label,
        warehouseId: stock?.warehouseId || line.warehouseId,
      };
    })
    .filter((line) => !input.includePersistentEvents || line.requiredQty > 0 || line.currentQty > 0)
    .sort((left, right) => left.label.localeCompare(right.label, "es"));

  const requiredTotal = lines.reduce((sum, line) => sum + line.requiredQty, 0);
  const loadedTotal = lines.reduce((sum, line) => sum + line.loadedQty, 0);
  const deliveredTotal = lines.reduce((sum, line) => sum + line.deliveredQty, 0);
  const currentTotal = lines.reduce((sum, line) => sum + line.currentQty, 0);
  const shortageTotal = lines.reduce((sum, line) => sum + line.shortageQty, 0);

  return {
    lines,
    requiredTotal,
    loadedTotal,
    deliveredTotal,
    currentTotal,
    shortageTotal,
    ready: shortageTotal <= 0,
  };
}

export function buildConductorTruckBalance(input: {
  vehicleId: string;
  vehicleName?: string;
  vehiclePlate?: string;
  assignedDriverId?: string | null;
  assignedDriverName?: string;
  events: ReadonlyArray<ConductorTruckInventoryEvent>;
  stock: ReadonlyArray<ConductorTruckStockItem>;
}): ConductorTruckBalance {
  const summary = buildConductorTruckInventory({
    tasks: [],
    events: input.events,
    stock: input.stock,
    includePersistentEvents: true,
  });

  return {
    vehicleId: input.vehicleId,
    vehicleName: input.vehicleName?.trim() || "",
    vehiclePlate: input.vehiclePlate?.trim() || "",
    assignedDriverId: input.assignedDriverId ?? null,
    assignedDriverName: input.assignedDriverName?.trim() || "",
    lines: summary.lines,
    totalQty: summary.currentTotal,
  };
}

export function buildConductorFullBoxCargo(
  events: ReadonlyArray<ConductorTruckInventoryEvent>,
  routeId?: string | null,
): ConductorFullBoxCargoSummary {
  const lines = new Map<string, ConductorFullBoxCargoLine>();

  for (const event of events) {
    if (
      event.eventType !== "collect_full_box" &&
      event.eventType !== "unload_full_box"
    ) {
      continue;
    }
    if (routeId && event.routeId !== routeId) {
      continue;
    }
    if (!event.taskId) {
      continue;
    }

    const key = `${event.taskId}|${event.catalogKey}|${event.itemLabel}`;
    const current = lines.get(key) || {
      key,
      taskId: event.taskId,
      shipmentId: event.shipmentId,
      routeId: event.routeId,
      label: event.itemLabel || event.itemName || "Caja llena",
      collectedQty: 0,
      unloadedQty: 0,
      pendingQty: 0,
    };
    const qty = Math.abs(Number(event.qty) || 0);
    if (event.eventType === "collect_full_box") current.collectedQty += qty;
    if (event.eventType === "unload_full_box") current.unloadedQty += qty;
    current.pendingQty = Math.max(current.collectedQty - current.unloadedQty, 0);
    lines.set(key, current);
  }

  const result = [...lines.values()].sort(
    (left, right) => left.label.localeCompare(right.label, "es") || left.key.localeCompare(right.key),
  );
  return {
    lines: result,
    collectedTotal: result.reduce((sum, line) => sum + line.collectedQty, 0),
    unloadedTotal: result.reduce((sum, line) => sum + line.unloadedQty, 0),
    pendingTotal: result.reduce((sum, line) => sum + line.pendingQty, 0),
  };
}

export function validateConductorTruckDeliver(
  line: ConductorTruckInventoryLine | null,
  qty: number,
) {
  const requestedQty = Math.max(Math.floor(Number(qty) || 0), 0);

  if (!line) {
    return "Caja no encontrada en camion";
  }

  if (requestedQty <= 0) {
    return "Cantidad invalida";
  }

  if (line.currentQty < requestedQty) {
    return `Faltan cajas en camion para ${line.label}`;
  }

  return "";
}

export function getConductorTruckLoadBlockReason(line: ConductorTruckInventoryLine) {
  if (line.shortageQty <= 0) {
    return "Ya no falta cargar esta caja";
  }

  if (!line.itemId || !line.warehouseId) {
    return `No hay item de inventario vinculado para ${line.label}`;
  }

  if (line.stockQty < line.shortageQty) {
    return `Stock insuficiente en bodega (${line.stockQty} disponibles)`;
  }

  return "";
}

export function canConductorTruckLineLoad(line: ConductorTruckInventoryLine) {
  return getConductorTruckLoadBlockReason(line) === "";
}

export function validateConductorTruckLoad(line: ConductorTruckInventoryLine, qty: number) {
  const requestedQty = Math.max(Math.floor(Number(qty) || 0), 0);

  if (requestedQty <= 0) {
    return "Cantidad invalida";
  }

  if (requestedQty > line.shortageQty) {
    return "No puedes cargar mas de lo requerido";
  }

  if (requestedQty > line.stockQty) {
    return `Stock insuficiente para ${line.label}`;
  }

  if (!line.itemId || !line.warehouseId) {
    return `No hay stock registrado para ${line.label}`;
  }

  return "";
}

export function validateConductorTruckReturn(line: ConductorTruckInventoryLine, qty: number) {
  const requestedQty = Math.max(Math.floor(Number(qty) || 0), 0);

  if (requestedQty <= 0) {
    return "Cantidad invalida";
  }

  if (requestedQty > line.currentQty) {
    return "No puedes devolver mas de lo que va en camion";
  }

  if (!line.itemId || !line.warehouseId) {
    return `No hay stock registrado para ${line.label}`;
  }

  return "";
}

export function validateConductorTruckReturnInput(input: {
  reason: string;
  targetVehicleId?: string | null;
}) {
  const reason = String(input.reason || "").trim();

  if (!CONDUCTOR_TRUCK_RETURN_REASONS.includes(reason as ConductorTruckReturnReason)) {
    return "Selecciona un motivo";
  }

  if (reason === CONDUCTOR_TRUCK_VEHICLE_CHANGE_REASON && !String(input.targetVehicleId || "").trim()) {
    return "Selecciona el vehículo destino";
  }

  return "";
}

export function isConductorTruckVehicleChangeReason(reason: string) {
  return String(reason || "").trim() === CONDUCTOR_TRUCK_VEHICLE_CHANGE_REASON;
}

export function validateConductorTaskResultInput(input: {
  result: "completed" | "failed";
  taskType: "deliver_empty_box" | "pickup_full_box";
  failureReason?: string;
  evidenceFileName?: string;
  invoiceVisible?: boolean;
  paymentAmount?: number;
}) {
  if (input.result === "completed" && !String(input.evidenceFileName || "").trim()) {
    return "Foto requerida";
  }

  if (input.result === "failed") {
    const reason = String(input.failureReason || "").trim();
    if (!CONDUCTOR_TASK_FAILURE_REASONS.includes(reason as ConductorTaskFailureReason)) {
      return "Selecciona una razon";
    }
    if (reason === "Invoice no visible" && !String(input.evidenceFileName || "").trim()) {
      return "Toma una foto de la caja sin invoice para reportarlo";
    }
  }

  if (input.result === "completed" && input.invoiceVisible !== true) {
    return "Confirma que el invoice se ve escrito en la caja";
  }

  if (input.paymentAmount !== undefined && input.paymentAmount < 0) {
    return "Monto invalido";
  }

  return "";
}
