import type {
  ShipmentLogisticsTaskRow,
  ShipmentRow,
  ShipmentStatus,
} from "@/app/actions/shipments";
import { formatScheduleAtDisplay } from "@/lib/sale/schedule-time";
import { readBillingFromPlan } from "@/lib/invoice-billing";
import { formatMoneyValue, parseMoneyValue } from "@/lib/logistics-fees";
import { legHasScheduleChange } from "@/lib/shipment-schedule-history";
import {
  EMPTY_BOX_LEG_LABELS,
  FULL_BOX_LEG_LABELS,
} from "@/lib/shipment-leg-labels";

type ShipmentProgressStepState = "done" | "active" | "pending";

export type ShipmentProgressKind =
  | "sale"
  | "empty_box"
  | "full_box"
  | "payment"
  | "office"
  | "pickup"
  | "transit"
  | "delivered";

export type ShipmentProgressChannel = "office" | "home" | "neutral";

export type ShipmentProgressStep = {
  id: string;
  title: string;
  detail: string;
  state: ShipmentProgressStepState;
  kind: ShipmentProgressKind;
  channel: ShipmentProgressChannel;
  channelLabel?: string;
  awaitingOrder?: boolean;
  driverTaskOrdered?: boolean;
  scheduleChanged?: boolean;
};

const EMPTY_BOX_OFFICE_MODE = "Cliente recoge caja vacia en oficina";
const EMPTY_BOX_DRIVER_MODE = "Programar entrega de caja vacia";
const FULL_BOX_OFFICE_MODE = "Cliente trae caja llena a oficina";
const FULL_BOX_DRIVER_MODE = "Programar recoleccion caja llena";

export const PENDING_EMPTY_BOX_STATUS = "Pendiente entrega caja vacía" as const;
export const PENDING_FULL_BOX_STATUS = "Pendiente recolección caja llena" as const;

const PENDING_SHIPMENT_STATUSES = [
  PENDING_EMPTY_BOX_STATUS,
  PENDING_FULL_BOX_STATUS,
] as const satisfies readonly ShipmentStatus[];

const TRANSIT_SHIPMENT_STATUSES = [
  "En oficina",
  "Pickup",
  "Enviado",
  "Entregado",
] as const satisfies readonly ShipmentStatus[];

export type EnviosStatusFilterBucket =
  | "recolecciones"
  | "entregas"
  | "en_oficina"
  | "en_transito"
  | "en_destino_final";

export const ENVIOS_STATUS_FILTER_OPTIONS: ReadonlyArray<{
  value: Exclude<EnviosStatusFilterBucket, "en_destino_final">;
  label: string;
}> = [
  { value: "recolecciones", label: "Recolecciones" },
  { value: "entregas", label: "Entregas" },
  { value: "en_oficina", label: "En oficina" },
  { value: "en_transito", label: "En tránsito" },
];

const ENVIOS_STATUS_BUCKET_LABEL: Record<EnviosStatusFilterBucket, string> = {
  recolecciones: "Recolecciones",
  entregas: "Entregas",
  en_oficina: "En oficina",
  en_transito: "En tránsito",
  en_destino_final: "Entregado",
};

export function isCompletedShipment(row: ShipmentRow) {
  return row.status === "Entregado";
}

export function isActiveShipment(row: ShipmentRow) {
  return row.status !== "Entregado";
}

export type EnviosClientMode = "tracking" | "history";

export function filterShipmentsForEnviosMode(
  shipments: ShipmentRow[],
  mode: EnviosClientMode,
) {
  return shipments.filter((row) =>
    mode === "tracking" ? isActiveShipment(row) : isCompletedShipment(row),
  );
}

function normalizeEnviosSearchText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es-MX")
    .replace(/\s+/g, " ")
    .trim();
}

function digitsOnly(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function primitiveSearchValues(value: unknown, seen = new WeakSet<object>()): string[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => primitiveSearchValues(entry, seen));
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return [];
    }

    seen.add(value);
    return Object.values(value).flatMap((entry) => primitiveSearchValues(entry, seen));
  }

  return [];
}

export function matchesEnviosSearchQuery(row: ShipmentRow, query: string) {
  const cleanQuery = normalizeEnviosSearchText(query);
  const queryDigits = digitsOnly(query);

  if (!cleanQuery && !queryDigits) {
    return true;
  }

  const fields = [
    row.id,
    row.code,
    row.customer_name,
    row.customerPhone,
    row.customerSearchText,
    row.carrier,
    row.country,
    row.status,
    row.salesOwnerName,
    row.delivery_notes,
    row.invoice_status,
    row.accounting_status,
    ...primitiveSearchValues(row.recipientSnapshot),
    ...primitiveSearchValues(row.logistics_plan),
    ...primitiveSearchValues(row.logisticsTasks),
    ...primitiveSearchValues(row.payments),
    ...primitiveSearchValues(row.contactLogs),
  ];
  const haystack = normalizeEnviosSearchText(fields.join(" "));
  const haystackDigits = digitsOnly(fields.join(" "));
  const queryIsDigitsOnly = Boolean(queryDigits) && digitsOnly(cleanQuery) === queryDigits;

  if (queryIsDigitsOnly) {
    return haystackDigits.includes(queryDigits) || haystack.includes(cleanQuery);
  }

  return cleanQuery
    .split(" ")
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

function classifyEnviosStatusFilterBucket(row: ShipmentRow): EnviosStatusFilterBucket {
  if (row.status === "Entregado") {
    return "en_destino_final";
  }

  if (row.status === "Enviado" || row.status === "Pickup") {
    return "en_transito";
  }

  if (row.status === "En oficina") {
    return "en_oficina";
  }

  if (row.status === PENDING_FULL_BOX_STATUS) {
    return "recolecciones";
  }

  if (row.status === PENDING_EMPTY_BOX_STATUS) {
    return "entregas";
  }

  const active = shipmentLogisticsSteps(row).find((step) => step.state === "active");

  if (!active) {
    return "entregas";
  }

  switch (active.kind) {
    case "full_box":
      return "recolecciones";
    case "empty_box":
      return "entregas";
    case "office":
      return "en_oficina";
    case "pickup":
    case "transit":
    case "delivered":
      return "en_transito";
    default:
      return "entregas";
  }
}

export function matchesEnviosStatusFilter(row: ShipmentRow, filter: string) {
  const clean = filter.trim();

  if (!clean) {
    return true;
  }

  return classifyEnviosStatusFilterBucket(row) === clean;
}

const OFFICE_RECEIVED_STATUSES = new Set<ShipmentRow["status"]>([
  "En oficina",
  "Pickup",
  "Enviado",
  "Entregado",
]);

const STATUS_RANK: Record<ShipmentStatus, number> = {
  [PENDING_EMPTY_BOX_STATUS]: 0,
  [PENDING_FULL_BOX_STATUS]: 0,
  "En oficina": 1,
  Pickup: 2,
  Enviado: 3,
  Entregado: 4,
};

export function isPendingShipmentStatus(status: ShipmentStatus): boolean {
  return (PENDING_SHIPMENT_STATUSES as readonly string[]).includes(status);
}

function isTransitShipmentStatus(status: ShipmentStatus): boolean {
  return (TRANSIT_SHIPMENT_STATUSES as readonly string[]).includes(status);
}

function shipmentStatusRank(status: ShipmentRow["status"]) {
  return STATUS_RANK[status] ?? 0;
}

function transitStepRaw(fullBoxDone: boolean, rank: number, doneAt: number, activeAt: number) {
  if (!fullBoxDone) {
    return "pending" as const;
  }

  if (rank >= doneAt) {
    return "done" as const;
  }

  if (rank >= activeAt) {
    return "active" as const;
  }

  return "pending" as const;
}

function stepMeta(
  kind: ShipmentProgressKind,
  channel: ShipmentProgressChannel = "neutral",
  channelLabel?: string,
) {
  return { kind, channel, channelLabel };
}

function pickupTransitStep(row: ShipmentRow, fullBoxDone: boolean) {
  const rank = shipmentStatusRank(row.status);
  const raw = transitStepRaw(fullBoxDone, rank, 2, 1);

  let detail = "Pendiente salida";

  if (rank >= 2) {
    detail = "Salida registrada";
  } else if (rank === 1 || fullBoxDone) {
    detail = "Lista para salida";
  }

  return {
    id: "pickup",
    title: "Salida",
    detail,
    ...stepMeta("pickup", "office", "Oficina"),
    raw,
  };
}

function deliveredTransitStep(row: ShipmentRow, fullBoxDone: boolean) {
  const rank = shipmentStatusRank(row.status);
  const raw = transitStepRaw(fullBoxDone, rank, 4, 3);

  let detail = "Pendiente entrega final";

  if (rank >= 4) {
    detail = "Entregado al destinatario";
  } else if (rank === 3) {
    detail = "Pendiente entrega en destino";
  }

  return {
    id: "delivered",
    title: "Destino",
    detail,
    ...stepMeta("delivered", "home", "Destino"),
    raw,
  };
}

function postFullBoxSteps(row: ShipmentRow, fullBoxDone: boolean) {
  return [
    pickupTransitStep(row, fullBoxDone),
    deliveredTransitStep(row, fullBoxDone),
  ];
}

export type ShipmentQuote = {
  label: string;
  paid: string;
  cost: string;
  total: string;
};

export type ShipmentBoxLine = {
  label: string;
  quantity: number;
  paid: string;
  cost: string;
};

export function formatBoxQuantityLabel(label: string, quantity = 1) {
  const cleanLabel = String(label || "").trim();
  const count = Math.max(Number(quantity) || 1, 1);

  if (!cleanLabel) {
    return "";
  }

  return `(${count}) ${cleanLabel}`;
}

function readBoxLineEntries(plan: Record<string, unknown>): ShipmentBoxLine[] {
  const rawLines = Array.isArray(plan.boxLines) ? plan.boxLines : [];

  return rawLines
    .map((entry) => {
      const line = entry && typeof entry === "object" && !Array.isArray(entry)
        ? (entry as Record<string, unknown>)
        : null;

      if (!line) {
        return null;
      }

      const label = String(line.label || "").trim();

      if (!label) {
        return null;
      }

      return {
        label,
        quantity: Math.max(Number(line.quantity) || 1, 1),
        paid: String(line.paid || "0"),
        cost: String(line.cost || "0"),
      } satisfies ShipmentBoxLine;
    })
    .filter((line): line is ShipmentBoxLine => Boolean(line));
}

export function readShipmentBoxLines(row: ShipmentRow): ShipmentBoxLine[] {
  const plan = row.logistics_plan || {};
  const lines = readBoxLineEntries(plan);

  if (lines.length) {
    return lines;
  }

  const box =
    plan.box && typeof plan.box === "object" && !Array.isArray(plan.box)
      ? (plan.box as Record<string, unknown>)
      : null;
  const label = String(box?.label || "").trim();
  const boxCount = Math.max(Number(plan.boxCount) || 1, 1);

  if (!label) {
    return [];
  }

  return [
    {
      label,
      quantity: boxCount,
      paid: String(box?.paid || "0"),
      cost: String(box?.cost || "0"),
    },
  ];
}

export function shipmentBoxLinesTriggerLabel(lines: ShipmentBoxLine[]): string {
  if (!lines.length) {
    return "";
  }

  if (lines.length === 1 && lines[0].quantity === 1) {
    return formatBoxQuantityLabel(lines[0].label, 1);
  }

  return "Cajas";
}

export function shipmentBoxLinesDetailLabel(lines: ShipmentBoxLine[]): string {
  return lines
    .map((line) => formatBoxQuantityLabel(line.label, line.quantity))
    .filter(Boolean)
    .join(" + ");
}

export function shipmentBoxLineTotal(line: ShipmentBoxLine): string {
  return formatMoneyValue(parseMoneyValue(line.paid) * line.quantity);
}

export function quoteFromShipment(row: ShipmentRow): ShipmentQuote | null {
  const lines = readShipmentBoxLines(row);

  if (lines.length) {
    const total = lines.reduce(
      (sum, line) => sum + parseMoneyValue(line.paid) * line.quantity,
      0,
    );
    const cost = lines.reduce(
      (sum, line) => sum + parseMoneyValue(line.cost) * line.quantity,
      0,
    );

    return {
      label: shipmentBoxLinesDetailLabel(lines),
      paid: formatMoneyValue(total),
      cost: formatMoneyValue(cost),
      total: formatMoneyValue(total),
    };
  }

  return null;
}

export function balanceDueFromShipment(row: ShipmentRow, quote: ShipmentQuote | null) {
  const billing = readBillingFromPlan(row.logistics_plan);

  if (billing) {
    return Math.max(parseMoneyValue(billing.quotedTotal) - row.paid, 0);
  }

  if (!quote) {
    return 0;
  }

  return Math.max(parseMoneyValue(quote.total) - row.paid, 0);
}

export function depositFromShipment(row: ShipmentRow) {
  const billing = readBillingFromPlan(row.logistics_plan);

  if (billing) {
    return parseMoneyValue(billing.depositRequired);
  }

  return row.paid;
}

export function totalFromShipment(row: ShipmentRow, quote: ShipmentQuote | null) {
  const billing = readBillingFromPlan(row.logistics_plan);

  if (billing) {
    return parseMoneyValue(billing.quotedTotal);
  }

  if (!quote) {
    return row.paid;
  }

  return parseMoneyValue(quote.total);
}

export function invoiceStatusLabel(status: ShipmentRow["invoice_status"]) {
  if (status === "paid") {
    return "Pagado";
  }

  if (status === "void") {
    return "Anulado";
  }

  return "Abierto";
}

function planLeg(plan: Record<string, unknown>, key: "emptyBox" | "fullBox") {
  const leg = plan[key];

  return leg && typeof leg === "object" && !Array.isArray(leg)
    ? (leg as Record<string, unknown>)
    : null;
}

function taskByType(row: ShipmentRow, taskType: ShipmentLogisticsTaskRow["taskType"]) {
  return row.logisticsTasks.find((task) => task.taskType === taskType);
}

function taskIsDone(task: ShipmentLogisticsTaskRow | undefined) {
  return task?.status === "completed";
}

function taskIsInProgress(task: ShipmentLogisticsTaskRow | undefined) {
  return Boolean(
    task &&
      task.status !== "completed" &&
      task.status !== "cancelled" &&
      task.status !== "pending",
  );
}

function legPlannedScheduleDetail(leg: Record<string, unknown> | null, fallback: string) {
  if (leg?.scheduleMode === "scheduled" && leg.scheduleAt) {
    return `Programado · ${formatScheduleAtDisplay(String(leg.scheduleAt))}`;
  }

  return fallback;
}

function scheduleDetail(task: ShipmentLogisticsTaskRow | undefined, pendingLabel: string) {
  if (!task) {
    return `${pendingLabel} · sin fecha`;
  }

  if (task.status === "scheduled" && task.scheduledAt) {
    return `Programado · ${formatScheduleAtDisplay(task.scheduledAt)}`;
  }

  if (taskIsInProgress(task)) {
    if (task.status === "loaded_to_truck") {
      return "En camión";
    }

    if (task.status === "assigned") {
      return "Chofer asignado";
    }

    return "En proceso";
  }

  return `${pendingLabel} · sin fecha`;
}

function logisticsTaskOpen(row: ShipmentRow, taskType: ShipmentLogisticsTaskRow["taskType"]) {
  const task = taskByType(row, taskType);

  return Boolean(task && task.status !== "cancelled");
}

function legDriverTaskOrdered(row: ShipmentRow, taskType: ShipmentLogisticsTaskRow["taskType"]) {
  return logisticsTaskOpen(row, taskType);
}

function driverLegAwaitingOrder(
  row: ShipmentRow,
  taskType: ShipmentLogisticsTaskRow["taskType"],
  mode: string,
) {
  if (!mode.includes("Programar")) {
    return false;
  }

  return !logisticsTaskOpen(row, taskType);
}

function resolveStepStates(
  steps: Array<
    Omit<ShipmentProgressStep, "state" | "awaitingOrder"> & {
      raw: "done" | "active" | "pending" | "awaiting_order";
    }
  >,
) {
  let foundActive = false;

  return steps.map((step) => {
    const { raw, ...rest } = step;

    if (raw === "done") {
      return { ...rest, state: "done" as const };
    }

    if (!foundActive && raw === "active") {
      foundActive = true;
      return { ...rest, state: "active" as const };
    }

    if (!foundActive && raw === "awaiting_order") {
      foundActive = true;
      return { ...rest, state: "active" as const, awaitingOrder: true };
    }

    if (!foundActive && raw === "pending") {
      foundActive = true;
      return { ...rest, state: "active" as const };
    }

    return { ...rest, state: "pending" as const };
  });
}

function emptyBoxStep(row: ShipmentRow, leg: Record<string, unknown> | null) {
  const mode = String(leg?.mode || "");
  const handingNow = leg?.handingNow === true;
  const task = taskByType(row, "deliver_empty_box");

  if (mode === EMPTY_BOX_OFFICE_MODE) {
    if (handingNow || taskIsDone(task) || Boolean(task?.stockDeductedAt)) {
      return {
        id: "empty",
        title: EMPTY_BOX_LEG_LABELS.short,
        detail: "Entregado en oficina",
        ...stepMeta("empty_box", "office", "Oficina"),
        raw: "done" as const,
      };
    }

    return {
      id: "empty",
      title: EMPTY_BOX_LEG_LABELS.short,
      detail: "Cliente recoge en oficina",
      ...stepMeta("empty_box", "office", "Oficina"),
      raw: "active" as const,
    };
  }

  if (mode === EMPTY_BOX_DRIVER_MODE) {
    if (taskIsDone(task) || Boolean(task?.stockDeductedAt)) {
      return {
        id: "empty",
        title: EMPTY_BOX_LEG_LABELS.short,
        detail: "Entregada a domicilio",
        ...stepMeta("empty_box", "home", "Domicilio"),
        raw: "done" as const,
      };
    }

    if (driverLegAwaitingOrder(row, "deliver_empty_box", mode)) {
      return {
        id: "empty",
        title: EMPTY_BOX_LEG_LABELS.short,
        detail: legPlannedScheduleDetail(leg, "Orden pendiente en envíos"),
        scheduleChanged: legHasScheduleChange(leg),
        ...stepMeta("empty_box", "home", "Domicilio"),
        raw: "awaiting_order" as const,
      };
    }

    return {
      id: "empty",
      title: EMPTY_BOX_LEG_LABELS.short,
      detail: scheduleDetail(task, "Pendiente entrega a domicilio"),
      scheduleChanged: legHasScheduleChange(leg),
      ...stepMeta("empty_box", "home", "Domicilio"),
      raw: taskIsInProgress(task) ? ("active" as const) : ("pending" as const),
    };
  }

  const summaryDetail = row.delivery_notes
    .split(" | ")
    .find((chunk) => chunk.toLowerCase().startsWith("caja vacia:"))
    ?.slice("Caja vacia:".length)
    .trim();

  return {
    id: "empty",
    title: EMPTY_BOX_LEG_LABELS.short,
    detail: summaryDetail || "Pendiente",
    ...stepMeta("empty_box"),
    raw: "pending" as const,
  };
}

function fullBoxStep(row: ShipmentRow, leg: Record<string, unknown> | null, emptyDone: boolean) {
  const mode = String(leg?.mode || "");
  const task = taskByType(row, "pickup_full_box");
  const officeReceived = OFFICE_RECEIVED_STATUSES.has(row.status) || row.status === "Entregado";

  if (mode === FULL_BOX_OFFICE_MODE) {
    if (officeReceived || taskIsDone(task)) {
      return {
        id: "full",
        title: FULL_BOX_LEG_LABELS.short,
        detail: "Recibida en oficina",
        ...stepMeta("full_box", "office", "Oficina"),
        raw: "done" as const,
      };
    }

    return {
      id: "full",
      title: FULL_BOX_LEG_LABELS.short,
      detail: emptyDone ? "Cliente la trae a oficina" : "Esperando caja vacía",
      ...stepMeta("full_box", "office", "Oficina"),
      raw: emptyDone ? ("active" as const) : ("pending" as const),
    };
  }

  if (mode === FULL_BOX_DRIVER_MODE) {
    if (taskIsDone(task) || row.status === "Entregado") {
      return {
        id: "full",
        title: FULL_BOX_LEG_LABELS.short,
        detail: "Recogida en domicilio",
        ...stepMeta("full_box", "home", "Domicilio"),
        raw: "done" as const,
      };
    }

    if (driverLegAwaitingOrder(row, "pickup_full_box", mode)) {
      return {
        id: "full",
        title: FULL_BOX_LEG_LABELS.short,
        detail: legPlannedScheduleDetail(leg, "Orden pendiente en envíos"),
        scheduleChanged: legHasScheduleChange(leg),
        ...stepMeta("full_box", "home", "Domicilio"),
        raw: emptyDone ? ("awaiting_order" as const) : ("pending" as const),
      };
    }

    return {
      id: "full",
      title: FULL_BOX_LEG_LABELS.short,
      detail: scheduleDetail(task, "Pendiente recolección a domicilio"),
      scheduleChanged: legHasScheduleChange(leg),
      ...stepMeta("full_box", "home", "Domicilio"),
      raw: emptyDone
        ? taskIsInProgress(task)
          ? ("active" as const)
          : ("pending" as const)
        : ("pending" as const),
    };
  }

  const summaryDetail = row.delivery_notes
    .split(" | ")
    .find((chunk) => chunk.toLowerCase().startsWith("caja llena:"))
    ?.slice("Caja llena:".length)
    .trim();

  return {
    id: "full",
    title: FULL_BOX_LEG_LABELS.short,
    detail: emptyDone ? "Orden pendiente en envíos" : summaryDetail || "Esperando caja vacía",
    ...stepMeta("full_box"),
    raw: officeReceived ? ("done" as const) : emptyDone ? ("awaiting_order" as const) : ("pending" as const),
  };
}

export type ShipmentPaymentProgress = {
  total: number;
  paid: number;
  pending: number;
  percentPaid: number;
  status: "paid" | "partial" | "void" | "open";
  statusLabel: string;
};

export function shipmentPaymentProgress(
  row: ShipmentRow,
  quote: ShipmentQuote | null,
): ShipmentPaymentProgress {
  const total = totalFromShipment(row, quote);
  const pending = balanceDueFromShipment(row, quote);
  const paid = Math.max(Math.min(row.paid, total), 0);

  if (row.invoice_status === "void") {
    return {
      total,
      paid,
      pending: 0,
      percentPaid: 0,
      status: "void",
      statusLabel: "Anulado",
    };
  }

  if (row.invoice_status === "paid" || pending <= 0) {
    return {
      total,
      paid: total > 0 ? total : paid,
      pending: 0,
      percentPaid: 100,
      status: "paid",
      statusLabel: "Pagado",
    };
  }

  const percentPaid = total > 0 ? Math.round((paid / total) * 100) : paid > 0 ? 100 : 0;

  return {
    total,
    paid,
    pending,
    percentPaid: Math.max(0, Math.min(percentPaid, 100)),
    status: paid > 0 ? "partial" : "open",
    statusLabel: paid > 0 ? "Abono parcial" : "Sin abonos",
  };
}

type ResolvePendingShipmentStatusInput = Pick<
  ShipmentRow,
  "sale_kind" | "logistics_plan" | "logisticsTasks" | "delivery_notes"
> &
  Partial<Pick<ShipmentRow, "empty_box_delivered_at" | "full_box_collected_at" | "status">>;

function draftShipmentRowForStatusResolve(
  input: ResolvePendingShipmentStatusInput,
): ShipmentRow {
  return {
    id: "",
    code: "",
    customerId: null,
    recipientId: null,
    recipientSnapshot: null,
    customer_name: "",
    country: "",
    carrier: "",
    paid: 0,
    profit: 0,
    status: input.status ?? PENDING_EMPTY_BOX_STATUS,
    assigned_to: null,
    createdBy: null,
    salesOwnerId: null,
    salesOwnerName: "",
    sale_kind: input.sale_kind,
    invoice_status: "open",
    invoice_priority: false,
    accounting_status: "not_exportable",
    created_at: null,
    finalized_at: null,
    empty_box_delivered_at: input.empty_box_delivered_at ?? null,
    full_box_collected_at: input.full_box_collected_at ?? null,
    office_received_at: null,
    departed_at: null,
    shipped_at: null,
    delivered_at: null,
    delivery_notes: input.delivery_notes ?? "",
    logistics_plan: input.logistics_plan,
    logisticsTasks: input.logisticsTasks,
    payments: [],
  };
}

export function sortShipmentsByInvoicePriority<T extends Pick<ShipmentRow, "invoice_priority" | "created_at">>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    if (a.invoice_priority !== b.invoice_priority) {
      return a.invoice_priority ? -1 : 1;
    }

    return String(b.created_at || "").localeCompare(String(a.created_at || ""));
  });
}

/** Newest invoices first (arrival / creation order). */
export function sortShipmentsByArrivalOrder<T extends Pick<ShipmentRow, "id" | "created_at">>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const byCreated = String(b.created_at || "").localeCompare(String(a.created_at || ""));
    if (byCreated !== 0) {
      return byCreated;
    }

    return String(b.id).localeCompare(String(a.id));
  });
}


/** Keeps order when the visible id set is unchanged (e.g. toggling invoice_priority). */
export function reconcileShipmentDisplayOrderIds<T extends Pick<ShipmentRow, "id" | "created_at">>(
  previousOrderIds: string[],
  rows: T[],
  options: { reset?: boolean } = {},
): string[] {
  if (options.reset || previousOrderIds.length === 0) {
    return sortShipmentsByArrivalOrder(rows).map((row) => row.id);
  }

  const rowIdSet = new Set(rows.map((row) => row.id));
  const kept = previousOrderIds.filter((id) => rowIdSet.has(id));

  if (kept.length === rows.length && kept.length === previousOrderIds.length) {
    return kept;
  }

  const keptSet = new Set(kept);
  const arrivals = sortShipmentsByArrivalOrder(rows);
  const added = arrivals.filter((row) => !keptSet.has(row.id)).map((row) => row.id);

  if (added.length === 0) {
    return kept;
  }

  const rank = new Map(arrivals.map((row, index) => [row.id, index]));
  const merged = [...kept];

  for (const id of added) {
    const idRank = rank.get(id) ?? merged.length;
    let insertAt = merged.length;

    for (let index = 0; index < merged.length; index += 1) {
      const existingRank = rank.get(merged[index]!) ?? Number.MAX_SAFE_INTEGER;
      if (idRank < existingRank) {
        insertAt = index;
        break;
      }
    }

    merged.splice(insertAt, 0, id);
  }

  return merged;
}

/** Keeps the current visual order while rows update (e.g. toggling invoice_priority). */
export function orderShipmentsByStableIds<T extends Pick<ShipmentRow, "id">>(
  rows: T[],
  orderIds: string[],
): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered: T[] = [];
  const seen = new Set<string>();

  for (const id of orderIds) {
    const row = byId.get(id);
    if (!row) {
      continue;
    }

    ordered.push(row);
    seen.add(id);
  }

  for (const row of rows) {
    if (!seen.has(row.id)) {
      ordered.push(row);
    }
  }

  return ordered;
}

export function resolvePendingShipmentStatus(
  input: ResolvePendingShipmentStatusInput | ShipmentRow,
): ShipmentStatus {
  const row = "id" in input && input.id ? (input as ShipmentRow) : draftShipmentRowForStatusResolve(input);
  const steps = shipmentLogisticsSteps(row);
  const active = steps.find((step) => step.state === "active");

  if (active?.kind === "empty_box") {
    return PENDING_EMPTY_BOX_STATUS;
  }

  if (active?.kind === "full_box") {
    return PENDING_FULL_BOX_STATUS;
  }

  if (!row.empty_box_delivered_at) {
    return PENDING_EMPTY_BOX_STATUS;
  }

  if (row.sale_kind === "full" && !row.full_box_collected_at) {
    return PENDING_FULL_BOX_STATUS;
  }

  return PENDING_EMPTY_BOX_STATUS;
}

export function resolveInitialShipmentStatus(input: {
  saleKind: ShipmentRow["sale_kind"];
  logisticsPlan: Record<string, unknown>;
  logisticsTasks?: ShipmentLogisticsTaskRow[];
  deliveryNotes?: string;
  emptyBoxDeliveredAt?: string | null;
}): ShipmentStatus {
  return resolvePendingShipmentStatus({
    sale_kind: input.saleKind,
    logistics_plan: input.logisticsPlan,
    logisticsTasks: input.logisticsTasks ?? [],
    delivery_notes: input.deliveryNotes ?? "",
    empty_box_delivered_at: input.emptyBoxDeliveredAt ?? null,
  });
}

export function syncShipmentStatusPatch(
  row: ShipmentRow,
): Partial<Pick<ShipmentRow, "status">> {
  if (isTransitShipmentStatus(row.status) || row.status === "Entregado") {
    return {};
  }

  const nextStatus = resolvePendingShipmentStatus(row);

  if (row.status === nextStatus) {
    return {};
  }

  return { status: nextStatus };
}

export function shipmentLogisticsSteps(row: ShipmentRow): ShipmentProgressStep[] {
  const plan = row.logistics_plan || {};
  const emptyLeg = planLeg(plan, "emptyBox");
  const fullLeg = planLeg(plan, "fullBox");

  const empty = emptyBoxStep(row, emptyLeg);
  const emptyDone = empty.raw === "done";
  const full = fullBoxStep(row, fullLeg, emptyDone);
  const fullDone = full.raw === "done";
  const rawSteps: Array<
    Omit<ShipmentProgressStep, "state" | "awaitingOrder"> & {
      raw: "done" | "active" | "pending" | "awaiting_order";
    }
  > = [
    withDriverTaskOrdered(row, empty),
    withDriverTaskOrdered(row, full),
    ...postFullBoxSteps(row, fullDone).map((step) => withDriverTaskOrdered(row, step)),
  ];

  return resolveStepStates(rawSteps);
}

function withDriverTaskOrdered<T extends { kind: ShipmentProgressKind }>(
  row: ShipmentRow,
  step: T,
): T & { driverTaskOrdered?: boolean } {
  if (step.kind === "empty_box") {
    return {
      ...step,
      driverTaskOrdered: legDriverTaskOrdered(row, "deliver_empty_box"),
    };
  }

  if (step.kind === "full_box") {
    return {
      ...step,
      driverTaskOrdered: legDriverTaskOrdered(row, "pickup_full_box"),
    };
  }

  return step;
}

export function shipmentStatusDisplayLabel(status: ShipmentStatus): string {
  if (status === "Enviado") {
    return "En tránsito";
  }

  if (status === "Pickup") {
    return "Pendiente salida";
  }

  return status;
}

export function shipmentOperationalStatusLabel(row: ShipmentRow): string {
  return ENVIOS_STATUS_BUCKET_LABEL[classifyEnviosStatusFilterBucket(row)];
}

export function shipmentOperationalDetailLabel(step: ShipmentProgressStep | null | undefined) {
  const detail = step?.detail.trim() || "";
  const normalized = detail.toLocaleLowerCase("es-MX");

  if (
    normalized === "chofer asignado" ||
    normalized.startsWith("pendiente entrega") ||
    normalized.startsWith("pendiente recolección") ||
    normalized.startsWith("pendiente recoleccion")
  ) {
    return "";
  }

  return detail;
}

export function shipmentOperationalDriverLabel(
  row: ShipmentRow,
  step: ShipmentProgressStep | null | undefined,
  driverLabelById: (driverId: string) => string | undefined = () => undefined,
) {
  const taskType =
    step?.kind === "empty_box"
      ? "deliver_empty_box"
      : step?.kind === "full_box"
        ? "pickup_full_box"
        : null;

  if (!taskType) {
    return "";
  }

  const task = taskByType(row, taskType);

  if (task?.assignedTo) {
    return `Chofer: ${driverLabelById(task.assignedTo) || task.assignedTo}`;
  }

  if (step?.channel === "home") {
    return "Sin chofer asignado";
  }

  return "";
}

export type ShipmentRouteAssignmentInfo = {
  routeName: string;
  assignedTo: string | null;
};

export type FullBoxPickupPlanStatus =
  | "inactive"
  | "deferred"
  | "marked"
  | "scheduled"
  | "office"
  | "done";

export function fullBoxPickupPlanStatus(
  row: ShipmentRow,
  step: ShipmentProgressStep | null | undefined,
): FullBoxPickupPlanStatus {
  if (!step || step.kind !== "full_box") {
    return "inactive";
  }

  const leg = planLeg(row.logistics_plan, "fullBox");
  const mode = String(leg?.mode || "");
  const task = taskByType(row, "pickup_full_box");

  if (step.state === "done" || taskIsDone(task)) {
    return "done";
  }

  if (mode === FULL_BOX_OFFICE_MODE) {
    return "office";
  }

  if (mode === FULL_BOX_DRIVER_MODE) {
    if (task?.status === "scheduled" && task.scheduledAt) {
      return "scheduled";
    }

    return "marked";
  }

  return "deferred";
}

export function fullBoxPickupPlanStatusLabel(status: FullBoxPickupPlanStatus) {
  if (status === "deferred") {
    return "Sin marcar";
  }

  if (status === "marked") {
    return "Marcada para recoger";
  }

  if (status === "scheduled") {
    return "Recolección programada";
  }

  if (status === "office") {
    return "Trae a oficina";
  }

  if (status === "done") {
    return "Recogida";
  }

  return "";
}

export type ShipmentOperationalAssignment = {
  routeLabel: string;
  routeAssigned: boolean;
  driverLabel: string;
  driverAssigned: boolean;
  isReady: boolean;
};

export const SHIPMENT_LOGISTICS_BRIDGE_LABEL =
  "Avisado a logística · pendiente ruta y conductor";

export function shipmentLogisticsBridgeLabel(
  assignment: ShipmentOperationalAssignment | null,
  step: ShipmentProgressStep | null | undefined,
): string {
  if (!assignment || assignment.isReady) {
    return "";
  }

  if (!step || (step.kind !== "empty_box" && step.kind !== "full_box")) {
    return "";
  }

  if (step.awaitingOrder || step.driverTaskOrdered !== true) {
    return "";
  }

  return SHIPMENT_LOGISTICS_BRIDGE_LABEL;
}

export function shipmentOperationalAssignment(
  row: ShipmentRow,
  step: ShipmentProgressStep | null | undefined,
  driverLabelById: (driverId: string) => string | undefined = () => undefined,
  routeByTaskId: (taskId: string) => ShipmentRouteAssignmentInfo | undefined = () => undefined,
): ShipmentOperationalAssignment | null {
  if (!step || (step.kind !== "empty_box" && step.kind !== "full_box")) {
    return null;
  }

  if (step.channel === "office") {
    return null;
  }

  if (step.awaitingOrder) {
    return null;
  }

  if (step.driverTaskOrdered !== true) {
    return null;
  }

  const taskType = step.kind === "empty_box" ? "deliver_empty_box" : "pickup_full_box";
  const task = taskByType(row, taskType);
  const route = task ? routeByTaskId(task.id) : undefined;
  const driverId = task?.assignedTo || route?.assignedTo || null;
  const routeAssigned = Boolean(route?.routeName);
  const driverAssigned = Boolean(driverId);

  return {
    routeLabel: routeAssigned ? route!.routeName : "Ruta no asignada",
    routeAssigned,
    driverLabel: driverAssigned
      ? driverLabelById(driverId!) || driverId!
      : "Conductor no asignado",
    driverAssigned,
    isReady: routeAssigned && driverAssigned,
  };
}

export function shipmentOperationalAssignmentLabel(
  row: ShipmentRow,
  step: ShipmentProgressStep | null | undefined,
  driverLabelById: (driverId: string) => string | undefined = () => undefined,
  routeByTaskId: (taskId: string) => ShipmentRouteAssignmentInfo | undefined = () => undefined,
) {
  const assignment = shipmentOperationalAssignment(row, step, driverLabelById, routeByTaskId);

  if (!assignment) {
    return "";
  }

  const routeLabel = assignment.routeAssigned
    ? `Ruta asignada: ${assignment.routeLabel}`
    : assignment.routeLabel;
  const driverLabel = assignment.driverAssigned
    ? `Conductor asignado: ${assignment.driverLabel}`
    : assignment.driverLabel;

  return `${routeLabel} · ${driverLabel}`;
}

export type EnviosReadinessFilter = "all" | "listos" | "pendientes";

export type EnviosReadinessBucket = "listos" | "pendientes";

function activeHomeLogisticsStep(row: ShipmentRow): ShipmentProgressStep | null {
  const step = shipmentLogisticsSteps(row).find((item) => item.state === "active");

  if (!step || (step.kind !== "empty_box" && step.kind !== "full_box")) {
    return null;
  }

  if (step.channel === "office") {
    return null;
  }

  return step;
}

export function classifyEnviosReadinessBucket(row: ShipmentRow): EnviosReadinessBucket | null {
  const step = activeHomeLogisticsStep(row);

  if (!step) {
    return null;
  }

  if (step.awaitingOrder || step.driverTaskOrdered !== true) {
    return "pendientes";
  }

  return "listos";
}

export function matchesEnviosReadinessFilter(row: ShipmentRow, filter: EnviosReadinessFilter) {
  if (filter === "all") {
    return true;
  }

  return classifyEnviosReadinessBucket(row) === filter;
}
