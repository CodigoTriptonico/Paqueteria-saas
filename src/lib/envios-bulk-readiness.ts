import type { ShipmentRow } from "@/app/actions/shipments";
import {
  EMPTY_BOX_DRIVER_MODE,
  FULL_BOX_DRIVER_MODE,
} from "@/components/sale/venta-parts";
import { shipmentLogisticsSteps } from "@/lib/shipment-display";
import type { ShipmentLogisticsEditorState } from "@/lib/shipment-logistics-edit";

export type EnviosBulkReadinessAction = "mark" | "unmark";

function activeHomeDriverLeg(row: ShipmentRow) {
  const step = shipmentLogisticsSteps(row).find((item) => item.state === "active");

  if (!step || (step.kind !== "empty_box" && step.kind !== "full_box")) {
    return null;
  }

  if (step.channel === "office") {
    return null;
  }

  return step;
}

export function resolveEnviosBulkReadinessPatch(
  row: ShipmentRow,
  action: EnviosBulkReadinessAction,
): Partial<ShipmentLogisticsEditorState> | null {
  const step = activeHomeDriverLeg(row);

  if (!step) {
    return null;
  }

  const isEmpty = step.kind === "empty_box";
  const alreadyOrdered = step.driverTaskOrdered === true;

  if (action === "mark") {
    if (alreadyOrdered) {
      return null;
    }

    if (isEmpty) {
      return {
        emptyBoxMode: EMPTY_BOX_DRIVER_MODE,
        emptyBoxDriverTaskOrdered: true,
        emptyBoxScheduleMode: "pending",
        emptyBoxScheduleAt: "",
        emptyBoxHandingNow: false,
      };
    }

    return {
      fullBoxMode: FULL_BOX_DRIVER_MODE,
      fullBoxDriverTaskOrdered: true,
      fullBoxScheduleMode: "pending",
      fullBoxScheduleAt: "",
    };
  }

  if (!alreadyOrdered) {
    return null;
  }

  if (isEmpty) {
    return {
      emptyBoxMode: "",
      emptyBoxDriverTaskOrdered: false,
      emptyBoxHandingNow: false,
      emptyBoxScheduleMode: "pending",
      emptyBoxScheduleAt: "",
    };
  }

  return {
    fullBoxMode: "",
    fullBoxDriverTaskOrdered: false,
    fullBoxScheduleMode: "pending",
    fullBoxScheduleAt: "",
  };
}

export function canApplyEnviosBulkReadiness(
  row: ShipmentRow,
  action: EnviosBulkReadinessAction,
) {
  return resolveEnviosBulkReadinessPatch(row, action) !== null;
}
