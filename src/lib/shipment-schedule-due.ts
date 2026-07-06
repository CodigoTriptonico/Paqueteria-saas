import type { ShipmentRow } from "@/app/actions/shipments";
import { scheduleAtToTimestamp } from "@/components/sale/schedule-time";
import {
  editorStateToUpdateInput,
  shipmentLogisticsEditorState,
  type UpdateShipmentLogisticsPlanInput,
} from "@/lib/shipment-logistics-edit";

function planLeg(row: ShipmentRow, legKey: "emptyBox" | "fullBox") {
  const leg = row.logistics_plan?.[legKey];

  return leg && typeof leg === "object" && !Array.isArray(leg)
    ? (leg as Record<string, unknown>)
    : null;
}

function legHasOpenTask(
  row: ShipmentRow,
  taskType: "deliver_empty_box" | "pickup_full_box",
) {
  return row.logisticsTasks.some(
    (task) => task.taskType === taskType && task.status !== "cancelled",
  );
}

export function isScheduledLegDue(scheduleAt: string, reference = new Date()) {
  const timestamp = scheduleAtToTimestamp(scheduleAt);

  if (!timestamp) {
    return false;
  }

  return Date.parse(timestamp) <= reference.getTime();
}

export function legAwaitingScheduledAutoOrder(
  row: ShipmentRow,
  legKey: "emptyBox" | "fullBox",
  taskType: "deliver_empty_box" | "pickup_full_box",
  reference = new Date(),
) {
  const leg = planLeg(row, legKey);

  if (!leg) {
    return false;
  }

  if (!String(leg.mode || "").includes("Programar")) {
    return false;
  }

  if (leg.driverTaskOrdered === true) {
    return false;
  }

  if (legHasOpenTask(row, taskType)) {
    return false;
  }

  if (leg.scheduleMode !== "scheduled") {
    return false;
  }

  const scheduleAt = String(leg.scheduleAt || "");

  if (!scheduleAt) {
    return false;
  }

  return isScheduledLegDue(scheduleAt, reference);
}

export function buildDueSchedulePromotionInput(
  row: ShipmentRow,
  reference = new Date(),
): UpdateShipmentLogisticsPlanInput | null {
  const state = shipmentLogisticsEditorState(row);
  let changed = false;

  if (legAwaitingScheduledAutoOrder(row, "emptyBox", "deliver_empty_box", reference)) {
    state.emptyBoxDriverTaskOrdered = true;
    changed = true;
  }

  if (
    row.sale_kind !== "empty_box_deposit" &&
    legAwaitingScheduledAutoOrder(row, "fullBox", "pickup_full_box", reference)
  ) {
    state.fullBoxDriverTaskOrdered = true;
    changed = true;
  }

  return changed ? editorStateToUpdateInput(state) : null;
}
