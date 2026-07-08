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
  "Problema de ruta",
  "Otra",
] as const;

export type ConductorTaskFailureReason = (typeof CONDUCTOR_TASK_FAILURE_REASONS)[number];

export type ConductorTruckEventType = "load" | "deliver" | "return" | "adjust";

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

export function findStockForTruckLine(
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

export function conductorTruckBoxLineIdentity(catalogKey: string, itemLabel: string) {
  return conductorTruckLineKey({ catalogKey, label: itemLabel });
}

export function eventCreatedAtScopeDate(createdAt?: string) {
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
      event.eventType === "return" &&
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

export function isOpenTruckDeliveryTask(task: Pick<ConductorTruckTaskInput, "taskType" | "status">) {
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
}): ConductorTruckInventorySummary {
  const requirements = new Map<string, ConductorTruckInventoryLine>();
  const scopedEvents = input.scope
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

  const lines = [...requirements.values()].map((line) => {
    const stock = findStockForTruckLine(line, input.stock);
    const stockQty = Math.max(Number(stock?.stock) || 0, 0);
    const currentQty = Math.max(Math.round(line.currentQty * 100) / 100, 0);
    const shortageQty = Math.max(line.requiredQty - currentQty, 0);

    return {
      ...line,
      currentQty,
      shortageQty,
      stockQty,
      itemId: stock?.itemId || null,
      itemName: stock?.itemName || line.label,
      warehouseId: stock?.warehouseId || line.warehouseId,
    };
  }).sort((left, right) => left.label.localeCompare(right.label, "es"));

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

export function validateConductorTaskResultInput(input: {
  result: "completed" | "failed";
  taskType: "deliver_empty_box" | "pickup_full_box";
  failureReason?: string;
  evidenceFileName?: string;
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
  }

  if (input.paymentAmount !== undefined && input.paymentAmount < 0) {
    return "Monto invalido";
  }

  return "";
}
