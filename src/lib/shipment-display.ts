import type {
  ShipmentLogisticsTaskRow,
  ShipmentRow,
  ShipmentStatus,
} from "@/app/actions/shipments";
import { formatScheduleAtDisplay } from "@/components/sale/schedule-time";
import { readBillingFromPlan } from "@/lib/invoice-billing";
import { formatMoneyValue, parseMoneyValue } from "@/lib/logistics-fees";

export type ShipmentProgressStepState = "done" | "active" | "pending";

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
};

const EMPTY_BOX_OFFICE_MODE = "Cliente recoge caja vacia en oficina";
const EMPTY_BOX_DRIVER_MODE = "Programar entrega de caja vacia";
const FULL_BOX_OFFICE_MODE = "Cliente trae caja llena a oficina";
const FULL_BOX_DRIVER_MODE = "Programar recoleccion caja llena";

const OFFICE_RECEIVED_STATUSES = new Set<ShipmentRow["status"]>([
  "En oficina",
  "Pickup",
  "Enviado",
  "Entregado",
]);

const STATUS_RANK: Record<ShipmentStatus, number> = {
  Pendiente: 0,
  "En oficina": 1,
  Pickup: 2,
  Enviado: 3,
  Entregado: 4,
};

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

function saleStep(row: ShipmentRow) {
  const billing = readBillingFromPlan(row.logistics_plan);
  const deposit = billing ? billing.payNow : formatMoneyValue(row.paid);

  return {
    id: "sale",
    title: "Venta",
    detail: `Invoice ${row.code} · Depósito ${deposit}`,
    ...stepMeta("sale"),
    raw: "done" as const,
  };
}

function officeTransitStep(row: ShipmentRow, fullBoxDone: boolean) {
  const rank = shipmentStatusRank(row.status);
  const raw = transitStepRaw(fullBoxDone, rank, 1, 0);

  let detail = "Pendiente recepción en oficina";

  if (rank >= 1) {
    detail = "Recibida en oficina";
  } else if (fullBoxDone) {
    detail = "Esperando registro en oficina";
  }

  return {
    id: "office",
    title: "En oficina",
    detail,
    ...stepMeta("office", "office", "Oficina"),
    raw,
  };
}

function pickupTransitStep(row: ShipmentRow, fullBoxDone: boolean) {
  const rank = shipmentStatusRank(row.status);
  const raw = transitStepRaw(fullBoxDone, rank, 2, 1);

  let detail = "Pendiente salida";

  if (rank >= 2) {
    detail = "Salida registrada";
  } else if (rank === 1) {
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

function shippedTransitStep(row: ShipmentRow, fullBoxDone: boolean) {
  const rank = shipmentStatusRank(row.status);
  const raw = transitStepRaw(fullBoxDone, rank, 3, 2);

  let detail = "Pendiente envío";

  if (rank >= 3) {
    detail = "En camino al destino";
  } else if (rank === 2) {
    detail = "Preparando envío internacional";
  }

  return {
    id: "transit",
    title: "En tránsito",
    detail,
    ...stepMeta("transit"),
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
    title: "Entregado",
    detail,
    ...stepMeta("delivered", "home", "Destino"),
    raw,
  };
}

function postFullBoxSteps(row: ShipmentRow, fullBoxDone: boolean) {
  return [
    officeTransitStep(row, fullBoxDone),
    pickupTransitStep(row, fullBoxDone),
    shippedTransitStep(row, fullBoxDone),
    deliveredTransitStep(row, fullBoxDone),
  ];
}

export type ShipmentQuote = {
  label: string;
  paid: string;
  cost: string;
  total: string;
};

export function quoteFromShipment(row: ShipmentRow): ShipmentQuote | null {
  const plan = row.logistics_plan || {};
  const boxLines = Array.isArray(plan.boxLines)
    ? (plan.boxLines as Record<string, unknown>[])
    : [];

  if (boxLines.length) {
    const labels = boxLines
      .map((line) => {
        const label = String(line.label || "").trim();
        const quantity = Math.max(Number(line.quantity) || 1, 1);
        return label ? `${label} x${quantity}` : "";
      })
      .filter(Boolean);

    const total = boxLines.reduce(
      (sum, line) =>
        sum + parseMoneyValue(String(line.paid || "0")) * Math.max(Number(line.quantity) || 1, 1),
      0,
    );
    const cost = boxLines.reduce(
      (sum, line) =>
        sum + parseMoneyValue(String(line.cost || "0")) * Math.max(Number(line.quantity) || 1, 1),
      0,
    );

    return {
      label: labels.join(" + "),
      paid: formatMoneyValue(total),
      cost: formatMoneyValue(cost),
      total: formatMoneyValue(total),
    };
  }

  const box =
    plan.box && typeof plan.box === "object" && !Array.isArray(plan.box)
      ? (plan.box as Record<string, unknown>)
      : null;
  const label = String(box?.label || "").trim();
  const boxCount = Math.max(Number(plan.boxCount) || 1, 1);

  if (!label) {
    return null;
  }

  const unitPaid = parseMoneyValue(String(box?.paid || "0"));
  const unitCost = parseMoneyValue(String(box?.cost || "0"));

  return {
    label: boxCount > 1 ? `${label} x${boxCount}` : label,
    paid: formatMoneyValue(unitPaid),
    cost: formatMoneyValue(unitCost),
    total: formatMoneyValue(unitPaid * boxCount),
  };
}

export function balanceDueFromShipment(row: ShipmentRow, quote: ShipmentQuote | null) {
  const billing = readBillingFromPlan(row.logistics_plan);

  if (billing) {
    return parseMoneyValue(billing.balanceDue);
  }

  if (!quote) {
    return 0;
  }

  return Math.max(parseMoneyValue(quote.total) - row.paid, 0);
}

export function depositFromShipment(row: ShipmentRow) {
  const billing = readBillingFromPlan(row.logistics_plan);

  if (billing) {
    return parseMoneyValue(billing.payNow);
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

function scheduleDetail(task: ShipmentLogisticsTaskRow | undefined, pendingLabel: string) {
  if (!task) {
    return pendingLabel;
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

  return pendingLabel;
}

function resolveStepStates(
  steps: Array<
    Omit<ShipmentProgressStep, "state"> & { raw: "done" | "active" | "pending" }
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
        title: "Entrega de caja vacía",
        detail: handingNow ? "Entregada en mostrador" : "Entregada en oficina",
        ...stepMeta("empty_box", "office", handingNow ? "Mostrador" : "Oficina"),
        raw: "done" as const,
      };
    }

    return {
      id: "empty",
      title: "Entrega de caja vacía",
      detail: "Cliente recoge en oficina",
      ...stepMeta("empty_box", "office", "Oficina"),
      raw: "active" as const,
    };
  }

  if (mode === EMPTY_BOX_DRIVER_MODE) {
    if (taskIsDone(task) || Boolean(task?.stockDeductedAt)) {
      return {
        id: "empty",
        title: "Entrega de caja vacía",
        detail: "Entregada a domicilio",
        ...stepMeta("empty_box", "home", "Domicilio"),
        raw: "done" as const,
      };
    }

    return {
      id: "empty",
      title: "Entrega de caja vacía",
      detail: scheduleDetail(task, "Pendiente entrega a domicilio"),
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
    title: "Entrega de caja vacía",
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
        title: "Recolección de caja llena",
        detail: "Recibida en oficina",
        ...stepMeta("full_box", "office", "Oficina"),
        raw: "done" as const,
      };
    }

    return {
      id: "full",
      title: "Recolección de caja llena",
      detail: emptyDone ? "Cliente la trae a oficina" : "Esperando caja vacía",
      ...stepMeta("full_box", "office", "Oficina"),
      raw: emptyDone ? ("active" as const) : ("pending" as const),
    };
  }

  if (mode === FULL_BOX_DRIVER_MODE) {
    if (taskIsDone(task) || row.status === "Entregado") {
      return {
        id: "full",
        title: "Recolección de caja llena",
        detail: "Recogida en domicilio",
        ...stepMeta("full_box", "home", "Domicilio"),
        raw: "done" as const,
      };
    }

    return {
      id: "full",
      title: "Recolección de caja llena",
      detail: scheduleDetail(task, "Pendiente recolección a domicilio"),
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

  if (!mode && !summaryDetail) {
    return null;
  }

  return {
    id: "full",
    title: "Recolección de caja llena",
    detail: summaryDetail || "Pendiente",
    ...stepMeta("full_box"),
    raw: officeReceived ? ("done" as const) : emptyDone ? ("active" as const) : ("pending" as const),
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

export function shipmentLogisticsSteps(row: ShipmentRow): ShipmentProgressStep[] {
  const plan = row.logistics_plan || {};
  const emptyLeg = planLeg(plan, "emptyBox");
  const fullLeg = planLeg(plan, "fullBox");

  const sale = saleStep(row);
  const empty = emptyBoxStep(row, emptyLeg);
  const emptyDone = empty.raw === "done";
  const full = row.sale_kind === "empty_box_deposit" ? null : fullBoxStep(row, fullLeg, emptyDone);
  const fullDone = full?.raw === "done";

  let rawSteps: Array<Omit<ShipmentProgressStep, "state"> & { raw: "done" | "active" | "pending" }>;

  if (row.sale_kind === "empty_box_deposit") {
    rawSteps = [sale, empty];
  } else if (full) {
    rawSteps = [sale, empty, full, ...postFullBoxSteps(row, fullDone)];
  } else {
    rawSteps = [sale, empty, ...postFullBoxSteps(row, emptyDone)];
  }

  return resolveStepStates(rawSteps);
}

export function shipmentOperationalStatusLabel(row: ShipmentRow): string {
  if (row.status === "Entregado") {
    return "Entregado";
  }

  if (row.status === "Enviado") {
    const steps = shipmentLogisticsSteps(row);
    const active = steps.find((step) => step.state === "active");

    if (active?.kind === "delivered") {
      return "Pendiente por entregar";
    }

    return "En tránsito";
  }

  if (row.status === "Pickup") {
    return "Pendiente salida";
  }

  if (row.status === "En oficina") {
    return "En oficina";
  }

  const steps = shipmentLogisticsSteps(row);
  const active = steps.find((step) => step.state === "active");

  if (!active) {
    return row.status;
  }

  if (active.kind === "full_box") {
    return "Pendiente por recoger";
  }

  if (active.kind === "empty_box" || active.kind === "delivered") {
    return "Pendiente por entregar";
  }

  if (active.kind === "transit") {
    return "En tránsito";
  }

  if (active.kind === "pickup") {
    return "Pendiente salida";
  }

  if (active.kind === "office") {
    return "Pendiente en oficina";
  }

  return row.status;
}
