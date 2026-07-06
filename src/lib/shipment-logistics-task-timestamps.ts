import type { ShipmentLogisticsTaskRow } from "@/app/actions/shipments";

export type LogisticsTaskTimestampFields = Pick<
  ShipmentLogisticsTaskRow,
  "orderedAt" | "assignedAt" | "loadedAt"
>;

export function logisticsTaskOrderInsertPatch(now = new Date().toISOString()) {
  return { ordered_at: now };
}

export function logisticsTaskReactivatePatch(now = new Date().toISOString()) {
  return {
    ordered_at: now,
    assigned_at: null,
    loaded_at: null,
    completed_at: null,
    stock_deducted_at: null,
  };
}

export function logisticsTaskCancelPatch() {
  return {
    ordered_at: null,
    assigned_at: null,
    loaded_at: null,
  };
}

export function logisticsTaskAssignedPatch(
  task: LogisticsTaskTimestampFields,
  now = new Date().toISOString(),
) {
  if (task.assignedAt) {
    return {};
  }

  return { assigned_at: now };
}

export function logisticsTaskLoadedPatch(
  task: LogisticsTaskTimestampFields,
  now = new Date().toISOString(),
) {
  if (task.loadedAt) {
    return {};
  }

  return { loaded_at: now };
}

export function isLogisticsTaskReactivation(
  existing: ShipmentLogisticsTaskRow | null | undefined,
) {
  return existing?.status === "cancelled";
}
