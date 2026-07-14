import { formatScheduleAtDisplay, scheduleAtToTimestamp } from "@/lib/sale/schedule-time";
import { formatScheduleDateInput } from "@/lib/schedule-date";
import { logisticsLegSnapshot } from "@/lib/shipment-audit";
import { EMPTY_BOX_LEG_LABELS, FULL_BOX_LEG_LABELS } from "@/lib/shipment-leg-labels";

export type LogisticsLegKey = "emptyBox" | "fullBox";

export type LegScheduleChange = {
  legKey: LogisticsLegKey;
  taskType: "deliver_empty_box" | "pickup_full_box";
  stepKind: "empty_box" | "full_box";
  stepTitle: string;
  beforeScheduleAt: string;
  afterScheduleAt: string;
};

const LEG_SCHEDULE_CONFIG: Array<{
  legKey: LogisticsLegKey;
  taskType: LegScheduleChange["taskType"];
  stepKind: LegScheduleChange["stepKind"];
  stepTitle: string;
}> = [
  {
    legKey: "emptyBox",
    taskType: "deliver_empty_box",
    stepKind: "empty_box",
    stepTitle: EMPTY_BOX_LEG_LABELS.auditStep,
  },
  {
    legKey: "fullBox",
    taskType: "pickup_full_box",
    stepKind: "full_box",
    stepTitle: FULL_BOX_LEG_LABELS.auditStep,
  },
];

export const SHIPMENT_SCHEDULE_UPDATED_ACTION = "shipment.schedule_updated";

export function normalizeScheduleAtKey(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const timestamp = scheduleAtToTimestamp(value);

  if (timestamp) {
    return timestamp;
  }

  const [date = "", time = ""] = value.split("T");
  return `${date}T${time}`;
}

export function legHasScheduleChange(leg: Record<string, unknown> | null | undefined) {
  if (!leg || typeof leg !== "object") {
    return false;
  }

  return Boolean(leg.originalScheduleAt && leg.scheduleChangedAt);
}

export function planLegRecord(
  plan: Record<string, unknown> | null | undefined,
  legKey: LogisticsLegKey,
) {
  const leg = plan?.[legKey];

  return leg && typeof leg === "object" && !Array.isArray(leg)
    ? (leg as Record<string, unknown>)
    : null;
}

export function detectLegScheduleChanges(
  beforePlan: Record<string, unknown>,
  afterPlan: Record<string, unknown>,
) {
  const changes: LegScheduleChange[] = [];

  for (const config of LEG_SCHEDULE_CONFIG) {
    const before = logisticsLegSnapshot(beforePlan, config.legKey);
    const after = logisticsLegSnapshot(afterPlan, config.legKey);

    if (!before || !after) {
      continue;
    }

    if (before.scheduleMode !== "scheduled" || after.scheduleMode !== "scheduled") {
      continue;
    }

    if (!before.scheduleAt || !after.scheduleAt) {
      continue;
    }

    if (normalizeScheduleAtKey(before.scheduleAt) === normalizeScheduleAtKey(after.scheduleAt)) {
      continue;
    }

    changes.push({
      legKey: config.legKey,
      taskType: config.taskType,
      stepKind: config.stepKind,
      stepTitle: config.stepTitle,
      beforeScheduleAt: before.scheduleAt,
      afterScheduleAt: after.scheduleAt,
    });
  }

  return changes;
}

export function applyScheduleChangeMetadata(
  beforePlan: Record<string, unknown>,
  afterPlan: Record<string, unknown>,
  actorName: string,
  changedAt: string,
) {
  const nextPlan = { ...afterPlan };

  for (const change of detectLegScheduleChanges(beforePlan, afterPlan)) {
    const leg = planLegRecord(nextPlan, change.legKey);

    if (!leg) {
      continue;
    }

    nextPlan[change.legKey] = {
      ...leg,
      originalScheduleAt: String(leg.originalScheduleAt || change.beforeScheduleAt),
      scheduleChangedAt: changedAt,
      scheduleChangedBy: actorName,
      scheduleChangeCount: Number(leg.scheduleChangeCount || 0) + 1,
    };
  }

  return nextPlan;
}

export function hasLogisticsPlanChangeBesidesSchedule(
  beforePlan: Record<string, unknown>,
  afterPlan: Record<string, unknown>,
) {
  const scheduleOnlyLegKeys = new Set(
    detectLegScheduleChanges(beforePlan, afterPlan).map((change) => change.legKey),
  );

  for (const legKey of ["emptyBox", "fullBox"] as const) {
    const before = logisticsLegSnapshot(beforePlan, legKey);
    const after = logisticsLegSnapshot(afterPlan, legKey);

    if (!before && !after) {
      continue;
    }

    const beforeComparable: Record<string, unknown> | null = before ? { ...before } : null;
    const afterComparable: Record<string, unknown> | null = after ? { ...after } : null;

    if (scheduleOnlyLegKeys.has(legKey)) {
      if (beforeComparable) {
        delete beforeComparable.scheduleAt;
      }

      if (afterComparable) {
        delete afterComparable.scheduleAt;
      }
    }

    if (JSON.stringify(beforeComparable) !== JSON.stringify(afterComparable)) {
      return true;
    }
  }

  const beforeNotes = String(beforePlan.notes || "");
  const afterNotes = String(afterPlan.notes || "");

  return beforeNotes !== afterNotes;
}

export function describeScheduleAuditChange(input: {
  beforeScheduleAt: string;
  afterScheduleAt: string;
  stepTitle?: string;
}) {
  const beforeLabel = formatScheduleAtDisplay(input.beforeScheduleAt);
  const afterLabel = formatScheduleAtDisplay(input.afterScheduleAt);
  const chunks = [`${beforeLabel} → ${afterLabel}`];

  if (input.stepTitle) {
    chunks.push(`Paso: ${input.stepTitle}`);
  }

  return chunks.join(" · ");
}

export function scheduleAuditTitle(shipmentCode: string) {
  return `Fecha · ${shipmentCode}`;
}

export function scheduleAuditMetadata(input: {
  shipmentCode: string;
  change: LegScheduleChange;
  source?: string;
  interaction?: string | null;
  stepTitle?: string | null;
  stepKind?: string | null;
}) {
  return {
    shipmentCode: input.shipmentCode,
    legKey: input.change.legKey,
    taskType: input.change.taskType,
    stepKind: input.stepKind || input.change.stepKind,
    stepTitle: input.stepTitle || input.change.stepTitle,
    source: input.source || "envios",
    interaction: input.interaction || null,
    beforeScheduleAt: input.change.beforeScheduleAt,
    afterScheduleAt: input.change.afterScheduleAt,
    beforeScheduleLabel: formatScheduleAtDisplay(input.change.beforeScheduleAt),
    afterScheduleLabel: formatScheduleAtDisplay(input.change.afterScheduleAt),
  };
}

export function isoToPlanScheduleAt(iso: string, previousScheduleAt?: string | null) {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return previousScheduleAt || iso;
  }

  const datePart = formatScheduleDateInput(date);
  const previousTime = previousScheduleAt?.split("T")[1];

  if (previousTime) {
    return `${datePart}T${previousTime}`;
  }

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${datePart}T${hours}:${minutes}`;
}

export function scheduleChangeFromTaskType(
  taskType: "deliver_empty_box" | "pickup_full_box",
): LegScheduleChange["legKey"] {
  return taskType === "deliver_empty_box" ? "emptyBox" : "fullBox";
}

export function scheduleHistoryDetailFromMetadata(metadata: Record<string, unknown>) {
  const before =
    typeof metadata.beforeScheduleLabel === "string"
      ? metadata.beforeScheduleLabel
      : typeof metadata.beforeScheduleAt === "string"
        ? formatScheduleAtDisplay(metadata.beforeScheduleAt)
        : "";
  const after =
    typeof metadata.afterScheduleLabel === "string"
      ? metadata.afterScheduleLabel
      : typeof metadata.afterScheduleAt === "string"
        ? formatScheduleAtDisplay(metadata.afterScheduleAt)
        : "";

  if (before && after) {
    return `${before} → ${after}`;
  }

  return "";
}
