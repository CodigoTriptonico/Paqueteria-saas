import type { ShipmentLogisticsTaskRow, ShipmentRow } from "@/app/actions/shipments";
import type { ShipmentProgressKind, ShipmentProgressStep } from "@/lib/shipment-display";
import {
  milestoneKeyForProgressKind,
  type ShipmentMilestoneKey,
} from "@/lib/shipment-milestones";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export type ShipmentStepGap = {
  fromKind: ShipmentProgressKind;
  toKind: ShipmentProgressKind;
  durationMs: number;
  label: string;
};

export type ShipmentTimings = {
  saleAgeMs: number;
  saleAgeLabel: string;
  completedAtByKind: Partial<Record<ShipmentProgressKind, string>>;
  gaps: ShipmentStepGap[];
  gapSummaries: string[];
  completedGapsLine: string | null;
  lastCompletedGap: string | null;
  progressStepLabel: string;
  activeElapsedMs: number | null;
  activeElapsedLabel: string | null;
  activeElapsedDetail: string | null;
  waitingHeadline: string | null;
  waitingSinceLabel: string | null;
  waitingText: string | null;
  activeStepShortName: string | null;
  isLongWait: boolean;
};

const STEP_SHORT_NAMES: Record<ShipmentProgressKind, string> = {
  sale: "Venta",
  empty_box: "Caja vacía",
  full_box: "Recolección",
  payment: "Cobro",
  office: "Oficina",
  pickup: "Salida",
  transit: "Tránsito",
  delivered: "Entrega",
};

function planLeg(plan: Record<string, unknown>, key: "emptyBox" | "fullBox") {
  const leg = plan[key];
  return leg && typeof leg === "object" && !Array.isArray(leg) ? (leg as Record<string, unknown>) : null;
}

function taskByType(row: ShipmentRow, taskType: ShipmentLogisticsTaskRow["taskType"]) {
  return row.logisticsTasks.find((task) => task.taskType === taskType);
}

function parseIso(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export function stepShortName(kind: ShipmentProgressKind) {
  return STEP_SHORT_NAMES[kind] || kind;
}

export function formatShipmentDuration(durationMs: number) {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return "";
  }

  if (durationMs < MINUTE_MS) {
    return "inmediato";
  }

  if (durationMs < HOUR_MS) {
    const minutes = Math.max(1, Math.round(durationMs / MINUTE_MS));
    return `${minutes} min`;
  }

  if (durationMs < DAY_MS) {
    const hours = Math.max(1, Math.round(durationMs / HOUR_MS));
    return hours === 1 ? "1 hora" : `${hours} horas`;
  }

  const days = Math.max(1, Math.round(durationMs / DAY_MS));
  return days === 1 ? "1 día" : `${days} días`;
}

export function formatShipmentRelative(iso: string, nowMs = Date.now()) {
  const at = parseIso(iso);
  if (at === null) {
    return "";
  }

  const durationMs = Math.max(0, nowMs - at);
  const duration = formatShipmentDuration(durationMs);

  if (duration === "inmediato") {
    return "hace un momento";
  }

  return `hace ${duration}`;
}

function gapPairLabel(fromKind: ShipmentProgressKind, toKind: ShipmentProgressKind) {
  return `${stepShortName(fromKind)} → ${stepShortName(toKind).toLowerCase()}`;
}

export function formatGapSummary(gap: ShipmentStepGap) {
  return `${gapPairLabel(gap.fromKind, gap.toKind)} · ${gap.label}`;
}

export function formatActiveElapsed(
  durationLabel: string,
  anchorKind: ShipmentProgressKind | null,
) {
  if (!durationLabel) {
    return null;
  }

  if (!anchorKind || anchorKind === "sale") {
    return `${durationLabel} desde la venta`;
  }

  return `${durationLabel} desde ${stepShortName(anchorKind).toLowerCase()}`;
}

export function formatWaitingHeadline(durationLabel: string) {
  if (!durationLabel || durationLabel === "inmediato") {
    return "Recién iniciado";
  }

  return `Lleva ${durationLabel}`;
}

export function formatWaitingSince(anchorKind: ShipmentProgressKind | null) {
  if (!anchorKind || anchorKind === "sale") {
    return "desde la venta";
  }

  return `desde ${stepShortName(anchorKind).toLowerCase()}`;
}

export function formatShipmentAbsolute(iso: string) {
  const at = parseIso(iso);
  if (at === null) {
    return "";
  }

  return new Date(at).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function milestoneColumnValue(row: ShipmentRow, key: ShipmentMilestoneKey) {
  return row[key] || null;
}

export function resolveStepCompletedAt(row: ShipmentRow, kind: ShipmentProgressKind): string | null {
  if (kind === "sale") {
    return row.created_at || null;
  }

  if (kind === "payment") {
    return row.finalized_at || null;
  }

  const milestoneKey = milestoneKeyForProgressKind(kind);
  if (milestoneKey) {
    const columnValue = milestoneColumnValue(row, milestoneKey);
    if (columnValue) {
      return columnValue;
    }
  }

  if (kind === "empty_box") {
    const emptyLeg = planLeg(row.logistics_plan, "emptyBox");
    const stockDeductedAt = String(emptyLeg?.stockDeductedAt || "").trim();
    if (stockDeductedAt) {
      return stockDeductedAt;
    }

    const task = taskByType(row, "deliver_empty_box");
    return task?.completedAt || task?.stockDeductedAt || null;
  }

  if (kind === "full_box") {
    const task = taskByType(row, "pickup_full_box");
    if (task?.completedAt) {
      return task.completedAt;
    }

    return row.full_box_collected_at || row.office_received_at || null;
  }

  return null;
}

function gapBetween(
  fromKind: ShipmentProgressKind,
  toKind: ShipmentProgressKind,
  fromIso: string,
  toIso: string,
): ShipmentStepGap | null {
  const fromMs = parseIso(fromIso);
  const toMs = parseIso(toIso);

  if (fromMs === null || toMs === null || toMs < fromMs) {
    return null;
  }

  const durationMs = toMs - fromMs;
  const label = formatShipmentDuration(durationMs);

  if (!label) {
    return null;
  }

  return { fromKind, toKind, durationMs, label };
}

export function buildShipmentTimings(
  row: ShipmentRow,
  steps: ShipmentProgressStep[],
  nowMs = Date.now(),
): ShipmentTimings {
  const completedAtByKind: Partial<Record<ShipmentProgressKind, string>> = {};

  for (const step of steps) {
    if (step.state === "pending") {
      continue;
    }

    const completedAt = resolveStepCompletedAt(row, step.kind);
    if (completedAt) {
      completedAtByKind[step.kind] = completedAt;
    }
  }

  const saleIso = row.created_at || null;
  const saleAgeMs = saleIso ? Math.max(0, nowMs - (parseIso(saleIso) || nowMs)) : 0;

  const gaps: ShipmentStepGap[] = [];

  for (let index = 1; index < steps.length; index += 1) {
    const previous = steps[index - 1];
    const current = steps[index];

    if (!previous || !current || current.state === "pending") {
      continue;
    }

    const fromIso =
      previous.state === "done" ? completedAtByKind[previous.kind] || null : null;
    const toIso = current.state === "done" ? completedAtByKind[current.kind] || null : null;

    if (!fromIso || !toIso) {
      continue;
    }

    const gap = gapBetween(previous.kind, current.kind, fromIso, toIso);
    if (gap) {
      gaps.push(gap);
    }
  }

  const activeStep = steps.find((step) => step.state === "active");
  const activeIndex = activeStep ? steps.findIndex((step) => step.id === activeStep.id) : -1;
  let activeElapsedMs: number | null = null;
  let activeElapsedLabel: string | null = null;
  let activeElapsedDetail: string | null = null;
  let waitingHeadline: string | null = null;
  let waitingSinceLabel: string | null = null;
  let waitingText: string | null = null;
  let activeStepShortName: string | null = null;
  let anchorKind: ShipmentProgressKind | null = null;

  if (activeStep) {
    activeStepShortName = stepShortName(activeStep.kind);
    const previousStep = activeIndex > 0 ? steps[activeIndex - 1] : null;

    if (previousStep?.state === "done") {
      anchorKind = previousStep.kind;
    } else {
      anchorKind = "sale";
    }

    const anchorIso =
      (anchorKind !== "sale" && anchorKind && completedAtByKind[anchorKind]) ||
      saleIso ||
      null;

    const anchorMs = parseIso(anchorIso);
    if (anchorMs !== null) {
      activeElapsedMs = Math.max(0, nowMs - anchorMs);
      const durationLabel = formatShipmentDuration(activeElapsedMs);
      activeElapsedDetail = formatActiveElapsed(durationLabel, anchorKind);
      activeElapsedLabel = activeElapsedDetail;
      waitingHeadline = formatWaitingHeadline(durationLabel);
      waitingSinceLabel = formatWaitingSince(anchorKind);
      waitingText = [waitingHeadline, waitingSinceLabel].filter(Boolean).join(" ") || null;
    }
  }

  const gapSummaries = gaps.map((gap) => formatGapSummary(gap));
  const completedGapsLine = gapSummaries.length ? gapSummaries.join(" · ") : null;
  const lastCompletedGap = gapSummaries.length ? gapSummaries[gapSummaries.length - 1] || null : null;
  const progressStepLabel =
    activeIndex >= 0 ? `Paso ${activeIndex + 1} de ${steps.length}` : `Paso ${steps.length} de ${steps.length}`;
  const isLongWait = activeElapsedMs !== null && activeElapsedMs >= DAY_MS;

  const saleRelative = saleIso ? formatShipmentRelative(saleIso, nowMs) : "";

  return {
    saleAgeMs,
    saleAgeLabel: saleRelative ? `Venta ${saleRelative}` : "",
    completedAtByKind,
    gaps,
    gapSummaries,
    completedGapsLine,
    lastCompletedGap,
    progressStepLabel,
    activeElapsedMs,
    activeElapsedLabel,
    activeElapsedDetail,
    waitingHeadline,
    waitingSinceLabel,
    waitingText,
    activeStepShortName,
    isLongWait,
  };
}

export function stepTimingTooltip(
  step: ShipmentProgressStep,
  timings: ShipmentTimings,
): string | undefined {
  const completedAt = timings.completedAtByKind[step.kind];
  if (!completedAt) {
    return step.title;
  }

  const relative = formatShipmentRelative(completedAt);
  const absolute = formatShipmentAbsolute(completedAt);

  if (!relative || !absolute) {
    return step.title;
  }

  return `${step.title} · ${relative} (${absolute})`;
}
