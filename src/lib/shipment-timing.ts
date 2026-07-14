import type { ShipmentLogisticsTaskRow, ShipmentRow } from "@/app/actions/shipments";
import {
  EMPTY_BOX_DRIVER_MODE,
  EMPTY_BOX_OFFICE_MODE,
  FULL_BOX_DRIVER_MODE,
} from "@/components/sale/venta-parts";
import type { ShipmentProgressKind, ShipmentProgressStep } from "@/lib/shipment-display";
import {
  milestoneKeyForProgressKind,
  type ShipmentMilestoneKey,
} from "@/lib/shipment-milestones";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export type SaleAgeTone = "fresh" | "recent" | "aging" | "stale" | "urgent";

const SALE_AGE_TEXT_CLASS: Record<SaleAgeTone, string> = {
  fresh: "text-slate-500",
  recent: "text-slate-400",
  aging: "text-slate-300",
  stale: "text-amber-400",
  urgent: "text-amber-300",
};

export function saleAgeTone(saleAgeMs: number): SaleAgeTone {
  if (!Number.isFinite(saleAgeMs) || saleAgeMs < 0) {
    return "fresh";
  }

  if (saleAgeMs < HOUR_MS) {
    return "fresh";
  }

  if (saleAgeMs < 6 * HOUR_MS) {
    return "recent";
  }

  if (saleAgeMs < DAY_MS) {
    return "aging";
  }

  if (saleAgeMs < 2 * DAY_MS) {
    return "stale";
  }

  return "urgent";
}

export function saleAgeTextClass(saleAgeMs: number): string {
  return SALE_AGE_TEXT_CLASS[saleAgeTone(saleAgeMs)];
}

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
  empty_box: "Dejar",
  full_box: "Recoger",
  payment: "Cobro",
  office: "Oficina",
  pickup: "Salida",
  transit: "Tránsito",
  delivered: "Destino",
};

function planLeg(plan: Record<string, unknown>, key: "emptyBox" | "fullBox") {
  const leg = plan[key];
  return leg && typeof leg === "object" && !Array.isArray(leg) ? (leg as Record<string, unknown>) : null;
}

function taskByType(row: ShipmentRow, taskType: ShipmentLogisticsTaskRow["taskType"]) {
  return row.logisticsTasks.find(
    (task) => task.taskType === taskType && task.status !== "cancelled",
  );
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
  const timingSteps: ShipmentProgressStep[] = saleIso
    ? [
        {
          id: "sale",
          title: "Venta",
          detail: "",
          state: "done",
          kind: "sale",
          channel: "neutral",
        },
        ...steps,
      ]
    : steps;

  if (saleIso) {
    completedAtByKind.sale = saleIso;
  }

  for (let index = 1; index < timingSteps.length; index += 1) {
    const previous = timingSteps[index - 1];
    const current = timingSteps[index];

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
    const canTrackActiveWait =
      activeStep.kind === "empty_box"
        ? shouldTrackEmptyBoxInProgressWait(
            row,
            activeStep,
            resolveStepCompletedAt(row, "empty_box"),
          )
        : activeStep.kind === "full_box"
          ? shouldTrackFullBoxInProgressWait(
              row,
              activeStep,
              resolveStepCompletedAt(row, "full_box"),
              resolveStepCompletedAt(row, "empty_box"),
            )
          : true;

    if (canTrackActiveWait) {
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

type ShipmentMilestoneAgeKey = "sale" | "empty_box" | "full_box";

type ShipmentMilestoneAgeStatus = "done" | "waiting" | "pending";

export type ShipmentMilestoneAge = {
  key: ShipmentMilestoneAgeKey;
  label: string;
  status: ShipmentMilestoneAgeStatus;
  completedAt: string | null;
  elapsedMs: number | null;
  elapsedLabel: string | null;
  detailLabel: string | null;
};

function progressStepState(
  steps: ShipmentProgressStep[],
  kind: ShipmentProgressKind,
): ShipmentProgressStep["state"] | null {
  return steps.find((step) => step.kind === kind)?.state ?? null;
}

function elapsedSince(iso: string | null, nowMs: number): number | null {
  const at = parseIso(iso);
  if (at === null) {
    return null;
  }

  return Math.max(0, nowMs - at);
}

export function milestoneAgeDisplayValue(age: ShipmentMilestoneAge): string {
  if (age.status === "pending" || age.elapsedMs === null) {
    return "—";
  }

  const duration = formatShipmentDuration(age.elapsedMs);
  return duration === "inmediato" ? "ahora" : duration;
}

function milestoneAgeFocus(ages: ShipmentMilestoneAge[]): ShipmentMilestoneAge {
  return (
    ages.find((age) => age.status === "waiting") ||
    ages.find((age) => age.key === "full_box" && age.status === "pending") ||
    ages.find((age) => age.key === "empty_box" && age.status === "pending") ||
    ages[0] || {
      key: "sale",
      label: "Venta",
      status: "pending",
      completedAt: null,
      elapsedMs: null,
      elapsedLabel: null,
      detailLabel: null,
    }
  );
}

const MILESTONE_INDICATOR_BUTTON_CLASS: Record<SaleAgeTone, string> = {
  fresh: "border-black bg-surface-inset text-slate-500 hover:text-slate-300",
  recent: "border-black bg-surface-inset text-slate-400 hover:text-slate-200",
  aging: "border-black bg-surface-inset text-slate-300 hover:text-slate-100",
  stale: "border-amber-600/40 bg-amber-950/20 text-amber-400 hover:text-amber-300",
  urgent: "border-amber-500/50 bg-amber-950/30 text-amber-300 hover:text-amber-200",
};

export function milestoneAgeIndicatorButtonClass(ages: ShipmentMilestoneAge[]): string {
  const focus = milestoneAgeFocus(ages);

  if (focus.status === "waiting") {
    return focus.elapsedMs !== null && focus.elapsedMs >= DAY_MS
      ? MILESTONE_INDICATOR_BUTTON_CLASS.urgent
      : MILESTONE_INDICATOR_BUTTON_CLASS.stale;
  }

  if (focus.status === "pending") {
    return "border-black bg-surface-inset text-slate-600 hover:text-slate-400";
  }

  return MILESTONE_INDICATOR_BUTTON_CLASS[saleAgeTone(focus.elapsedMs ?? 0)];
}

function buildDoneMilestoneAge(
  key: ShipmentMilestoneAgeKey,
  label: string,
  completedAt: string,
  nowMs: number,
): ShipmentMilestoneAge {
  const elapsedMs = elapsedSince(completedAt, nowMs) ?? 0;
  const elapsedLabel = formatShipmentRelative(completedAt, nowMs);

  return {
    key,
    label,
    status: "done",
    completedAt,
    elapsedMs,
    elapsedLabel,
    detailLabel: elapsedLabel ? `${label} ${elapsedLabel}` : label,
  };
}

function buildWaitingMilestoneAge(
  key: ShipmentMilestoneAgeKey,
  label: string,
  anchorIso: string | null,
  sinceLabel: string,
  nowMs: number,
): ShipmentMilestoneAge {
  const elapsedMs = anchorIso ? elapsedSince(anchorIso, nowMs) : null;
  const durationLabel = elapsedMs !== null ? formatShipmentDuration(elapsedMs) : "";
  const detailLabel = durationLabel
    ? `${label} · lleva ${durationLabel} ${sinceLabel}`
    : `${label} · en curso`;

  return {
    key,
    label,
    status: "waiting",
    completedAt: null,
    elapsedMs,
    elapsedLabel: durationLabel || null,
    detailLabel,
  };
}

function buildPendingMilestoneAge(
  key: ShipmentMilestoneAgeKey,
  label: string,
  detailLabel?: string,
): ShipmentMilestoneAge {
  return {
    key,
    label,
    status: "pending",
    completedAt: null,
    elapsedMs: null,
    elapsedLabel: null,
    detailLabel: detailLabel ?? `${label} · pendiente`,
  };
}

function activeStepForKind(
  steps: ShipmentProgressStep[],
  kind: ShipmentProgressKind,
): ShipmentProgressStep | null {
  return steps.find((step) => step.kind === kind && step.state === "active") ?? null;
}

function legIsMarkedReady(step: ShipmentProgressStep | null) {
  return step?.driverTaskOrdered === true;
}

function logisticsLegMode(plan: Record<string, unknown>, key: "emptyBox" | "fullBox") {
  return String(planLeg(plan, key)?.mode || "");
}

function shouldTrackEmptyBoxInProgressWait(
  row: ShipmentRow,
  step: ShipmentProgressStep | null,
  emptyCompletedAt: string | null,
) {
  if (!step || emptyCompletedAt || step.awaitingOrder) {
    return false;
  }

  const mode = logisticsLegMode(row.logistics_plan, "emptyBox");
  if (!mode) {
    return false;
  }

  if (mode === EMPTY_BOX_DRIVER_MODE) {
    return legIsMarkedReady(step);
  }

  return mode === EMPTY_BOX_OFFICE_MODE;
}

function shouldTrackFullBoxInProgressWait(
  row: ShipmentRow,
  step: ShipmentProgressStep | null,
  fullCompletedAt: string | null,
  emptyCompletedAt: string | null,
) {
  if (!step || fullCompletedAt || step.awaitingOrder) {
    return false;
  }

  const mode = logisticsLegMode(row.logistics_plan, "fullBox");
  if (!mode) {
    return false;
  }

  if (mode === FULL_BOX_DRIVER_MODE) {
    return legIsMarkedReady(step);
  }

  return Boolean(emptyCompletedAt);
}

function legOrderAnchorIso(
  row: ShipmentRow,
  taskType: ShipmentLogisticsTaskRow["taskType"],
): string | null {
  const task = taskByType(row, taskType);
  return task?.orderedAt || null;
}

function buildActiveLegMilestoneAge(
  key: ShipmentMilestoneAgeKey,
  label: string,
  step: ShipmentProgressStep,
  row: ShipmentRow,
  taskType: ShipmentLogisticsTaskRow["taskType"],
  saleIso: string | null,
  fallbackSinceLabel: string,
  fallbackAnchorIso: string | null,
  nowMs: number,
): ShipmentMilestoneAge {
  if (!legIsMarkedReady(step)) {
    return buildPendingMilestoneAge(key, label, `${label} · sin marcar`);
  }

  const anchorIso = legOrderAnchorIso(row, taskType) || saleIso;
  const sinceLabel =
    anchorIso && anchorIso !== saleIso ? "desde que se marcó" : fallbackSinceLabel;

  return buildWaitingMilestoneAge(key, label, anchorIso, sinceLabel, nowMs);
}

export function buildShipmentMilestoneAges(
  row: ShipmentRow,
  steps: ShipmentProgressStep[],
  nowMs = Date.now(),
): ShipmentMilestoneAge[] {
  const saleIso = row.created_at || null;
  const emptyCompletedAt = resolveStepCompletedAt(row, "empty_box");
  const fullCompletedAt = resolveStepCompletedAt(row, "full_box");
  const emptyState = progressStepState(steps, "empty_box");
  const fullState = progressStepState(steps, "full_box");
  const emptyLabel = stepShortName("empty_box");
  const fullLabel = stepShortName("full_box");

  const saleAge = saleIso
    ? buildDoneMilestoneAge("sale", "Venta", saleIso, nowMs)
    : buildPendingMilestoneAge("sale", "Venta");

  let emptyAge: ShipmentMilestoneAge;
  if (emptyCompletedAt) {
    emptyAge = buildDoneMilestoneAge("empty_box", emptyLabel, emptyCompletedAt, nowMs);
  } else if (emptyState === "active") {
    const activeEmptyStep = activeStepForKind(steps, "empty_box");
    emptyAge = activeEmptyStep
      ? buildActiveLegMilestoneAge(
          "empty_box",
          emptyLabel,
          activeEmptyStep,
          row,
          "deliver_empty_box",
          saleIso,
          "desde la venta",
          saleIso,
          nowMs,
        )
      : buildPendingMilestoneAge("empty_box", emptyLabel);
  } else {
    emptyAge = buildPendingMilestoneAge("empty_box", emptyLabel);
  }

  let fullAge: ShipmentMilestoneAge;
  if (fullCompletedAt) {
    fullAge = buildDoneMilestoneAge("full_box", fullLabel, fullCompletedAt, nowMs);
  } else if (fullState === "active") {
    const activeFullStep = activeStepForKind(steps, "full_box");
    const fallbackAnchor = emptyCompletedAt || saleIso;
    const fallbackSince = emptyCompletedAt ? "desde dejar" : "desde la venta";
    fullAge = activeFullStep
      ? buildActiveLegMilestoneAge(
          "full_box",
          fullLabel,
          activeFullStep,
          row,
          "pickup_full_box",
          saleIso,
          fallbackSince,
          fallbackAnchor,
          nowMs,
        )
      : buildPendingMilestoneAge("full_box", fullLabel);
  } else {
    fullAge = buildPendingMilestoneAge("full_box", fullLabel);
  }

  return [saleAge, emptyAge, fullAge];
}

export type ShipmentTimingInsightStatus = "done" | "active" | "pending";

export type ShipmentTimingInsightRow = {
  id: string;
  label: string;
  value: string;
  status: ShipmentTimingInsightStatus;
  detail: string | null;
  elapsedMs: number | null;
};

function legUsesDriverDelivery(plan: Record<string, unknown>, key: "emptyBox" | "fullBox") {
  const leg = planLeg(plan, key);
  const driverMode = key === "emptyBox" ? EMPTY_BOX_DRIVER_MODE : FULL_BOX_DRIVER_MODE;
  return String(leg?.mode || "") === driverMode;
}

function insightDurationValue(durationMs: number) {
  const duration = formatShipmentDuration(durationMs);
  return duration === "inmediato" ? "<1 min" : duration;
}

function insightGapRow(
  id: string,
  label: string,
  fromIso: string | null,
  toIso: string | null,
  nowMs: number,
  options?: {
    allowInProgress?: boolean;
    pendingDetail?: string;
    activePrefix?: string;
  },
): ShipmentTimingInsightRow {
  if (!fromIso) {
    return {
      id,
      label,
      value: "—",
      status: "pending",
      detail: options?.pendingDetail ?? "Pendiente",
      elapsedMs: null,
    };
  }

  if (!toIso) {
    if (!options?.allowInProgress) {
      return {
        id,
        label,
        value: "—",
        status: "pending",
        detail: options?.pendingDetail ?? "Pendiente",
        elapsedMs: null,
      };
    }

    const elapsedMs = elapsedSince(fromIso, nowMs);
    const duration = formatShipmentDuration(elapsedMs ?? 0);

    return {
      id,
      label,
      value: duration === "inmediato" ? "ahora" : duration,
      status: "active",
      detail: `${options?.activePrefix ?? "Lleva"} ${duration} · desde ${formatShipmentAbsolute(fromIso)}`,
      elapsedMs,
    };
  }

  const fromMs = parseIso(fromIso);
  const toMs = parseIso(toIso);

  if (fromMs === null || toMs === null || toMs < fromMs) {
    return {
      id,
      label,
      value: "—",
      status: "pending",
      detail: null,
      elapsedMs: null,
    };
  }

  const durationMs = toMs - fromMs;

  return {
    id,
    label,
    value: insightDurationValue(durationMs),
    status: "done",
    detail: `${formatShipmentAbsolute(fromIso)} → ${formatShipmentAbsolute(toIso)}`,
    elapsedMs: durationMs,
  };
}

export function timingInsightRowTextClass(
  status: ShipmentTimingInsightStatus,
  elapsedMs: number | null,
): string {
  if (status === "pending") {
    return "text-slate-600";
  }

  if (status === "active") {
    return elapsedMs !== null && elapsedMs >= DAY_MS ? "text-amber-300" : "text-amber-400/90";
  }

  return saleAgeTextClass(elapsedMs ?? 0);
}

export function buildShipmentTimingInsightPanel(
  row: ShipmentRow,
  steps: ShipmentProgressStep[],
  nowMs = Date.now(),
): ShipmentTimingInsightRow[] {
  const saleIso = row.created_at || null;
  const plan = row.logistics_plan;
  const emptyTask = taskByType(row, "deliver_empty_box");
  const fullTask = taskByType(row, "pickup_full_box");
  const emptyOrderedAt = emptyTask?.orderedAt || null;
  const fullOrderedAt = fullTask?.orderedAt || null;
  const emptyCompletedAt = resolveStepCompletedAt(row, "empty_box");
  const fullCompletedAt = resolveStepCompletedAt(row, "full_box");
  const emptyDriver = legUsesDriverDelivery(plan, "emptyBox");
  const fullDriver = legUsesDriverDelivery(plan, "fullBox");
  const emptyActive = activeStepForKind(steps, "empty_box");
  const fullActive = activeStepForKind(steps, "full_box");

  const rows: ShipmentTimingInsightRow[] = [];

  if (saleIso) {
    const elapsedMs = elapsedSince(saleIso, nowMs) ?? 0;
    const relative = formatShipmentRelative(saleIso, nowMs);

    rows.push({
      id: "sale",
      label: "Venta",
      value: relative.replace(/^hace /, ""),
      status: "done",
      detail: `Registrada ${relative} · ${formatShipmentAbsolute(saleIso)}`,
      elapsedMs,
    });
  } else {
    rows.push({
      id: "sale",
      label: "Venta",
      value: "—",
      status: "pending",
      detail: "Sin fecha de venta",
      elapsedMs: null,
    });
  }

  if (emptyDriver) {
    rows.push(
      insightGapRow(
        "sale-mark-empty",
        "Venta → marcar dejar",
        saleIso,
        emptyOrderedAt,
        nowMs,
        {
          pendingDetail: emptyActive && !legIsMarkedReady(emptyActive)
            ? "Aún no se marca para dejar"
            : "Pendiente",
        },
      ),
      insightGapRow(
        "mark-empty-done",
        "Marcar dejar → dejado",
        emptyOrderedAt,
        emptyCompletedAt,
        nowMs,
        {
          allowInProgress: Boolean(
            emptyOrderedAt &&
              !emptyCompletedAt &&
              legIsMarkedReady(emptyActive),
          ),
          pendingDetail: "Aún no se marca para dejar",
          activePrefix: "Lleva dejando",
        },
      ),
    );
  } else {
    rows.push(
      insightGapRow("sale-empty-done", "Venta → dejado", saleIso, emptyCompletedAt, nowMs, {
        allowInProgress: shouldTrackEmptyBoxInProgressWait(row, emptyActive, emptyCompletedAt),
        pendingDetail: "Aún no se deja la caja vacía",
        activePrefix: "Lleva pendiente dejar",
      }),
    );
  }

  if (fullDriver) {
    rows.push(
      insightGapRow(
        "empty-mark-full",
        "Dejado → marcar recoger",
        emptyCompletedAt,
        fullOrderedAt,
        nowMs,
        {
          pendingDetail: !emptyCompletedAt
            ? "Primero hay que dejar la caja vacía"
            : "Aún no se marca para recoger",
        },
      ),
      insightGapRow(
        "mark-full-done",
        "Marcar recoger → recogido",
        fullOrderedAt,
        fullCompletedAt,
        nowMs,
        {
          allowInProgress: Boolean(
            fullOrderedAt &&
              !fullCompletedAt &&
              legIsMarkedReady(fullActive),
          ),
          pendingDetail: !fullOrderedAt ? "Aún no se marca para recoger" : "Pendiente",
          activePrefix: "Lleva recogiendo",
        },
      ),
    );
  } else if (String(planLeg(plan, "fullBox")?.mode || "").trim()) {
    rows.push(
      insightGapRow(
        "empty-full-done",
        "Dejado → recogido",
        emptyCompletedAt,
        fullCompletedAt,
        nowMs,
        {
          allowInProgress: shouldTrackFullBoxInProgressWait(
            row,
            fullActive,
            fullCompletedAt,
            emptyCompletedAt,
          ),
          pendingDetail: !emptyCompletedAt
            ? "Primero hay que dejar la caja vacía"
            : "Aún no se recoge la caja llena",
          activePrefix: "Lleva pendiente recoger",
        },
      ),
    );
  }

  return rows;
}

type LogisticsPhaseKey = "ordered" | "scheduled" | "assigned" | "loaded" | "completed";

type LogisticsPhase = {
  key: LogisticsPhaseKey;
  label: string;
  at: string | null;
  relative: string | null;
  gapFromPreviousMs: number | null;
  gapFromPreviousLabel: string | null;
};

type LogisticsLegTiming = {
  taskType: ShipmentLogisticsTaskRow["taskType"];
  legLabel: string;
  orderedAt: string | null;
  scheduledAt: string | null;
  assignedAt: string | null;
  loadedAt: string | null;
  completedAt: string | null;
  phases: LogisticsPhase[];
  activePhaseLabel: string | null;
  activeElapsedMs: number | null;
  activeElapsedLabel: string | null;
  orderToCompleteMs: number | null;
  orderToCompleteLabel: string | null;
};

type LogisticsSubGap = {
  fromLabel: string;
  toLabel: string;
  durationMs: number;
  label: string;
};

export type ShipmentAuditTimings = ShipmentTimings & {
  emptyBoxLeg: LogisticsLegTiming | null;
  fullBoxLeg: LogisticsLegTiming | null;
  logisticsGaps: LogisticsSubGap[];
  logisticsGapsLine: string | null;
};

function subGapBetween(fromLabel: string, toLabel: string, fromIso: string | null, toIso: string | null) {
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

  return { fromLabel, toLabel, durationMs, label };
}

function buildLogisticsLegTiming(
  task: ShipmentLogisticsTaskRow | undefined,
  legLabel: string,
  nowMs = Date.now(),
): LogisticsLegTiming | null {
  if (!task || task.status === "cancelled") {
    return null;
  }

  const orderedAt = task.orderedAt || task.createdAt || null;
  const scheduledAt = task.scheduledAt;
  const assignedAt = task.assignedAt;
  const loadedAt = task.loadedAt || task.stockDeductedAt;
  const completedAt = task.completedAt;

  const phaseDefs: Array<{ key: LogisticsPhaseKey; label: string; at: string | null }> = [
    { key: "ordered", label: "Ordenada en envíos", at: orderedAt },
    { key: "scheduled", label: "Fecha programada", at: scheduledAt },
    { key: "assigned", label: "Asignada a chofer", at: assignedAt },
    { key: "loaded", label: "Cargada a ruta", at: loadedAt },
    { key: "completed", label: "Completada", at: completedAt },
  ];

  let previousAt: string | null = null;
  const phases: LogisticsPhase[] = phaseDefs.map((phase) => {
    const gap =
      previousAt && phase.at ? subGapBetween("anterior", phase.label, previousAt, phase.at) : null;

    if (phase.at) {
      previousAt = phase.at;
    }

    return {
      key: phase.key,
      label: phase.label,
      at: phase.at,
      relative: phase.at ? formatShipmentRelative(phase.at, nowMs) : null,
      gapFromPreviousMs: gap?.durationMs ?? null,
      gapFromPreviousLabel: gap?.label ?? null,
    };
  });

  const orderToCompleteMs =
    orderedAt && completedAt
      ? Math.max(0, (parseIso(completedAt) || nowMs) - (parseIso(orderedAt) || nowMs))
      : null;

  let activePhaseLabel: string | null = null;
  let activeElapsedMs: number | null = null;

  if (!completedAt && orderedAt) {
    const anchorMs = parseIso(orderedAt);
    if (anchorMs !== null) {
      activeElapsedMs = Math.max(0, nowMs - anchorMs);
      activePhaseLabel = `desde que se ordenó en envíos (${formatShipmentDuration(activeElapsedMs)})`;
    }
  }

  return {
    taskType: task.taskType,
    legLabel,
    orderedAt,
    scheduledAt,
    assignedAt,
    loadedAt,
    completedAt,
    phases,
    activePhaseLabel,
    activeElapsedMs,
    activeElapsedLabel: activePhaseLabel,
    orderToCompleteMs,
    orderToCompleteLabel:
      orderToCompleteMs !== null ? formatShipmentDuration(orderToCompleteMs) : null,
  };
}

function buildLogisticsLegTimings(row: ShipmentRow, nowMs = Date.now()) {
  const emptyTask = taskByType(row, "deliver_empty_box");
  const fullTask = taskByType(row, "pickup_full_box");

  return {
    emptyBoxLeg: buildLogisticsLegTiming(emptyTask, "Dejar caja vacía", nowMs),
    fullBoxLeg: buildLogisticsLegTiming(fullTask, "Recoger caja llena", nowMs),
  };
}

export function buildShipmentAuditTimings(
  row: ShipmentRow,
  steps: ShipmentProgressStep[],
  nowMs = Date.now(),
): ShipmentAuditTimings {
  const base = buildShipmentTimings(row, steps, nowMs);
  const { emptyBoxLeg, fullBoxLeg } = buildLogisticsLegTimings(row, nowMs);
  const logisticsGaps: LogisticsSubGap[] = [];

  for (const leg of [emptyBoxLeg, fullBoxLeg]) {
    if (!leg) {
      continue;
    }

    const ordered = leg.orderedAt;
    const completed = leg.completedAt;
    const gap = subGapBetween("Ordenada", "Completada", ordered, completed);
    if (gap) {
      logisticsGaps.push({
        ...gap,
        fromLabel: `${leg.legLabel} · ordenada`,
        toLabel: `${leg.legLabel} · completada`,
      });
    }

    for (let index = 1; index < leg.phases.length; index += 1) {
      const previous = leg.phases[index - 1];
      const current = leg.phases[index];
      if (!previous?.at || !current?.at) {
        continue;
      }

      const phaseGap = subGapBetween(previous.label, current.label, previous.at, current.at);
      if (phaseGap) {
        logisticsGaps.push({
          ...phaseGap,
          fromLabel: `${leg.legLabel} · ${previous.label.toLowerCase()}`,
          toLabel: `${leg.legLabel} · ${current.label.toLowerCase()}`,
        });
      }
    }
  }

  const logisticsGapsLine = logisticsGaps.length
    ? logisticsGaps.map((gap) => `${gap.fromLabel} → ${gap.toLabel} · ${gap.label}`).join(" · ")
    : null;

  return {
    ...base,
    emptyBoxLeg,
    fullBoxLeg,
    logisticsGaps,
    logisticsGapsLine,
  };
}

export function stepTimingTooltip(
  step: ShipmentProgressStep,
): string | undefined {
  return step.title;
}
