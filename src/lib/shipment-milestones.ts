import type { ShipmentStatus } from "@/app/actions/shipments";
import type { ShipmentProgressKind } from "@/lib/shipment-display";
import { formatShipmentAbsolute } from "@/lib/shipment-timing";

/** Milestone keys stored as timestamptz columns on public.shipments. */
export type ShipmentMilestoneKey =
  | "empty_box_delivered_at"
  | "full_box_collected_at"
  | "office_received_at"
  | "departed_at"
  | "shipped_at"
  | "delivered_at";

export type ShipmentMilestoneTimestamps = Partial<Record<ShipmentMilestoneKey, string | null>>;

export type ShipmentMilestoneSource =
  | "status_update"
  | "logistics_task"
  | "counter_handoff"
  | "sale_created"
  | "backfill";

export const SHIPMENT_MILESTONE_ACTION = "shipment.milestone_recorded";

export const MILESTONE_LABELS: Record<ShipmentMilestoneKey, string> = {
  empty_box_delivered_at: "Entrega caja vacía",
  full_box_collected_at: "Recolección caja llena",
  office_received_at: "Recepción en oficina",
  departed_at: "Salida",
  shipped_at: "En tránsito",
  delivered_at: "Entregado",
};

const STATUS_MILESTONE: Partial<Record<ShipmentStatus, ShipmentMilestoneKey>> = {
  "En oficina": "office_received_at",
  Pickup: "departed_at",
  Enviado: "shipped_at",
  Entregado: "delivered_at",
};

const PROGRESS_KIND_MILESTONE: Partial<Record<ShipmentProgressKind, ShipmentMilestoneKey>> = {
  empty_box: "empty_box_delivered_at",
  full_box: "full_box_collected_at",
  office: "office_received_at",
  pickup: "departed_at",
  transit: "shipped_at",
  delivered: "delivered_at",
};

export function milestoneKeyForStatus(status: ShipmentStatus): ShipmentMilestoneKey | null {
  return STATUS_MILESTONE[status] || null;
}

export function milestoneKeyForProgressKind(kind: ShipmentProgressKind): ShipmentMilestoneKey | null {
  return PROGRESS_KIND_MILESTONE[kind] || null;
}

export function milestoneKeyForLogisticsTask(
  taskType: "deliver_empty_box" | "pickup_full_box",
): ShipmentMilestoneKey | null {
  if (taskType === "deliver_empty_box") {
    return "empty_box_delivered_at";
  }

  if (taskType === "pickup_full_box") {
    return "full_box_collected_at";
  }

  return null;
}

/** Returns DB patch entries only for milestones not yet recorded. */
export function buildFirstMilestonePatch(
  current: ShipmentMilestoneTimestamps,
  entries: Array<{ key: ShipmentMilestoneKey; recordedAt: string }>,
): Partial<Record<ShipmentMilestoneKey, string>> {
  const patch: Partial<Record<ShipmentMilestoneKey, string>> = {};

  for (const entry of entries) {
    if (!current[entry.key]) {
      patch[entry.key] = entry.recordedAt;
    }
  }

  return patch;
}

export function newlyRecordedMilestones(
  before: ShipmentMilestoneTimestamps,
  patch: Partial<Record<ShipmentMilestoneKey, string>>,
): Array<{ key: ShipmentMilestoneKey; recordedAt: string }> {
  return (Object.entries(patch) as Array<[ShipmentMilestoneKey, string]>).filter(
    ([key]) => !before[key],
  ).map(([key, recordedAt]) => ({ key, recordedAt }));
}

export type ShipmentMilestoneAuditInput = {
  shipmentId: string;
  shipmentCode: string;
  milestone: ShipmentMilestoneKey;
  recordedAt: string;
  source: ShipmentMilestoneSource;
  customerName?: string;
  country?: string;
  previousStatus?: string;
  nextStatus?: string;
  taskId?: string;
  taskType?: string;
  actorInteraction?: string;
  stepTitle?: string | null;
  stepKind?: string | null;
};

export function shipmentMilestoneAuditPayload(input: ShipmentMilestoneAuditInput) {
  const label = MILESTONE_LABELS[input.milestone];

  return {
    action: SHIPMENT_MILESTONE_ACTION,
    entityType: "shipment",
    entityId: input.shipmentId,
    title: label,
    description: milestoneHistoryDescription(input),
    metadata: {
      milestone: input.milestone,
      milestoneLabel: MILESTONE_LABELS[input.milestone],
      recordedAt: input.recordedAt,
      source: input.source,
      shipmentCode: input.shipmentCode,
      customerName: input.customerName || null,
      country: input.country || null,
      previousStatus: input.previousStatus || null,
      nextStatus: input.nextStatus || null,
      taskId: input.taskId || null,
      taskType: input.taskType || null,
      interaction: input.actorInteraction || null,
      stepTitle: input.stepTitle || null,
      stepKind: input.stepKind || null,
    },
  };
}

function milestoneHistoryDescription(input: ShipmentMilestoneAuditInput) {
  if (input.source === "counter_handoff") {
    return "Entregada en mostrador";
  }

  if (input.source === "logistics_task") {
    return "Completada en logística";
  }

  if (input.nextStatus) {
    return `Estado marcado: ${input.nextStatus}`;
  }

  const formatted = formatShipmentAbsolute(input.recordedAt);
  return formatted ? `Registrado ${formatted}` : "Registrado";
}

export function readShipmentMilestones(row: ShipmentMilestoneTimestamps): ShipmentMilestoneTimestamps {
  return {
    empty_box_delivered_at: row.empty_box_delivered_at || null,
    full_box_collected_at: row.full_box_collected_at || null,
    office_received_at: row.office_received_at || null,
    departed_at: row.departed_at || null,
    shipped_at: row.shipped_at || null,
    delivered_at: row.delivered_at || null,
  };
}
