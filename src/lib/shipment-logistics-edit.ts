import type { ShipmentLogisticsTaskRow, ShipmentRow } from "@/app/actions/shipments";
import {
  EMPTY_BOX_DRIVER_MODE,
  EMPTY_BOX_OFFICE_MODE,
  FULL_BOX_DRIVER_MODE,
  logisticsDriverTaskCount,
  logisticsSummary,
} from "@/components/sale/venta-parts";

export type ShipmentLogisticsLegInput = {
  mode: string;
  handingNow?: boolean;
  scheduleMode?: string;
  scheduleAt?: string | null;
  /** When true, creates/syncs the driver logistics task in Envíos. Schedule-only updates leave this false. */
  driverTaskOrdered?: boolean;
};

export type UpdateShipmentLogisticsPlanInput = {
  emptyBox: ShipmentLogisticsLegInput;
  fullBox?: ShipmentLogisticsLegInput | null;
};

export type ShipmentLogisticsEditorState = {
  emptyBoxMode: string;
  emptyBoxHandingNow: boolean;
  emptyBoxScheduleMode: string;
  emptyBoxScheduleAt: string;
  emptyBoxDriverTaskOrdered: boolean;
  fullBoxMode: string;
  fullBoxScheduleMode: string;
  fullBoxScheduleAt: string;
  fullBoxDriverTaskOrdered: boolean;
};

const OFFICE_RECEIVED_STATUSES = new Set<ShipmentRow["status"]>([
  "En oficina",
  "Pickup",
  "Enviado",
  "Entregado",
]);

function planLeg(plan: Record<string, unknown>, key: "emptyBox" | "fullBox") {
  const leg = plan[key];

  return leg && typeof leg === "object" && !Array.isArray(leg)
    ? (leg as Record<string, unknown>)
    : null;
}

function activeTask(row: ShipmentRow, taskType: ShipmentLogisticsTaskRow["taskType"]) {
  return row.logisticsTasks.find(
    (task) => task.taskType === taskType && task.status !== "cancelled",
  );
}

function syncTask(row: ShipmentRow, taskType: ShipmentLogisticsTaskRow["taskType"]) {
  const active = activeTask(row, taskType);
  if (active) {
    return active;
  }

  return row.logisticsTasks.find(
    (task) => task.taskType === taskType && task.status === "cancelled",
  );
}

export function shipmentLogisticsEditorState(row: ShipmentRow): ShipmentLogisticsEditorState {
  const empty = planLeg(row.logistics_plan, "emptyBox") || {};
  const full = planLeg(row.logistics_plan, "fullBox") || {};
  const emptyScheduleAt = String(empty.scheduleAt || "");
  const fullScheduleAt = String(full.scheduleAt || "");

  return {
    emptyBoxMode: String(empty.mode || ""),
    emptyBoxHandingNow: empty.handingNow === true,
    emptyBoxScheduleMode: String(empty.scheduleMode || "pending"),
    emptyBoxScheduleAt: emptyScheduleAt,
    emptyBoxDriverTaskOrdered:
      empty.driverTaskOrdered === true || Boolean(activeTask(row, "deliver_empty_box")),
    fullBoxMode: String(full.mode || ""),
    fullBoxScheduleMode: String(full.scheduleMode || "pending"),
    fullBoxScheduleAt: fullScheduleAt,
    fullBoxDriverTaskOrdered:
      full.driverTaskOrdered === true || Boolean(activeTask(row, "pickup_full_box")),
  };
}

export function emptyBoxLegLocked(row: ShipmentRow) {
  const leg = planLeg(row.logistics_plan, "emptyBox");

  if (leg?.stockDeductedAt) {
    return true;
  }

  if (leg?.handingNow === true) {
    return true;
  }

  const task = activeTask(row, "deliver_empty_box");

  return task?.status === "completed";
}

export function fullBoxLegLocked(row: ShipmentRow) {
  if (row.sale_kind === "empty_box_deposit") {
    return true;
  }

  if (OFFICE_RECEIVED_STATUSES.has(row.status)) {
    return true;
  }

  const task = activeTask(row, "pickup_full_box");

  return task?.status === "completed";
}

export function emptyBoxLegLockReason(row: ShipmentRow) {
  const leg = planLeg(row.logistics_plan, "emptyBox");

  if (leg?.handingNow === true || leg?.stockDeductedAt) {
    return "La caja vacía ya se entregó en mostrador.";
  }

  const task = activeTask(row, "deliver_empty_box");

  if (task?.status === "completed") {
    return "La entrega de caja vacía ya se completó.";
  }

  return "";
}

export function fullBoxLegLockReason(row: ShipmentRow) {
  if (row.sale_kind === "empty_box_deposit") {
    return "Este invoice es solo depósito de caja vacía.";
  }

  if (OFFICE_RECEIVED_STATUSES.has(row.status)) {
    return "La caja llena ya está registrada en oficina.";
  }

  const task = activeTask(row, "pickup_full_box");

  if (task?.status === "completed") {
    return "La recolección de caja llena ya se completó.";
  }

  return "";
}

function resolveDriverTaskOrdered(
  existing: Record<string, unknown> | null,
  input: ShipmentLogisticsLegInput,
  driverNeeded: boolean,
) {
  if (!driverNeeded) {
    return false;
  }

  if (input.driverTaskOrdered === true) {
    return true;
  }

  if (input.driverTaskOrdered === false) {
    return false;
  }

  return existing?.driverTaskOrdered === true;
}

function buildLegPatch(
  existing: Record<string, unknown> | null,
  input: ShipmentLogisticsLegInput,
  driverTaskType: "deliver_empty_box" | "pickup_full_box",
  includeHandingNow: boolean,
) {
  const driverNeeded = input.mode.includes("Programar");

  return {
    ...(existing || {}),
    label: existing?.label || (driverTaskType === "deliver_empty_box" ? "empty_box" : "full_box"),
    mode: input.mode,
    handingNow:
      includeHandingNow && input.mode === EMPTY_BOX_OFFICE_MODE ? input.handingNow === true : null,
    scheduleMode: driverNeeded ? input.scheduleMode || "pending" : null,
    scheduleAt: driverNeeded ? input.scheduleAt || null : null,
    driverTaskNeeded: driverNeeded,
    driverTaskOrdered: resolveDriverTaskOrdered(existing, input, driverNeeded),
    driverTaskType: driverNeeded ? driverTaskType : null,
  };
}

function buildDeferredEmptyBoxLeg(existing: Record<string, unknown> | null) {
  return {
    ...(existing || {}),
    label: existing?.label || "empty_box",
    mode: "",
    deferred: true,
    handingNow: null,
    scheduleMode: null,
    scheduleAt: null,
    driverTaskNeeded: false,
    driverTaskOrdered: false,
    driverTaskType: null,
  };
}

function buildDeferredFullBoxLeg(existing: Record<string, unknown> | null) {
  return {
    ...(existing || {}),
    label: existing?.label || "full_box",
    mode: "",
    deferred: true,
    handingNow: null,
    scheduleMode: null,
    scheduleAt: null,
    driverTaskNeeded: false,
    driverTaskOrdered: false,
    driverTaskType: null,
  };
}

function legDriverTaskNeeded(
  row: ShipmentRow,
  taskType: "deliver_empty_box" | "pickup_full_box",
  mode: string,
  driverMode: string,
  input: ShipmentLogisticsLegInput,
  legKey: "emptyBox" | "fullBox",
) {
  if (mode !== driverMode) {
    return false;
  }

  if (activeTask(row, taskType)) {
    return true;
  }

  const existingLeg = planLeg(row.logistics_plan, legKey);

  return input.driverTaskOrdered === true || existingLeg?.driverTaskOrdered === true;
}

export function emptyBoxDeliveryCanClear(row: ShipmentRow, input: UpdateShipmentLogisticsPlanInput) {
  if (input.emptyBox.mode) {
    return false;
  }

  const currentMode = String(planLeg(row.logistics_plan, "emptyBox")?.mode || "");

  if (!currentMode) {
    return false;
  }

  return !emptyBoxLegLocked(row);
}

export function fullBoxPickupCanClear(row: ShipmentRow, input: UpdateShipmentLogisticsPlanInput) {
  if (!input.fullBox || input.fullBox.mode) {
    return false;
  }

  const currentMode = String(planLeg(row.logistics_plan, "fullBox")?.mode || "");

  if (!currentMode) {
    return false;
  }

  return !fullBoxLegLocked(row);
}

export function buildUpdatedLogisticsPlan(
  row: ShipmentRow,
  input: UpdateShipmentLogisticsPlanInput,
) {
  const plan = { ...(row.logistics_plan || {}) };
  const notes = String(plan.notes || "").trim();
  const emptyExisting = planLeg(plan, "emptyBox");
  const fullExisting = planLeg(plan, "fullBox");

  const emptyBox = !input.emptyBox.mode
    ? buildDeferredEmptyBoxLeg(emptyExisting)
    : buildLegPatch(emptyExisting, input.emptyBox, "deliver_empty_box", true);
  const fullBox =
    row.sale_kind === "empty_box_deposit" || !input.fullBox
      ? fullExisting
      : !input.fullBox.mode
        ? buildDeferredFullBoxLeg(fullExisting)
        : buildLegPatch(fullExisting, input.fullBox, "pickup_full_box", false);

  const emptyBoxMode = String(emptyBox.mode || "");
  const fullBoxMode = String(fullBox?.mode || "");

  const deliveryNotes = logisticsSummary(
    emptyBoxMode,
    String(emptyBox.scheduleMode || "pending"),
    String(emptyBox.scheduleAt || ""),
    fullBoxMode,
    String(fullBox?.scheduleMode || "pending"),
    String(fullBox?.scheduleAt || ""),
    notes,
  );

  const nextPlan = {
    ...plan,
    emptyBox,
    ...(fullBox ? { fullBox } : {}),
    driverTaskCount: logisticsDriverTaskCount(emptyBoxMode, fullBoxMode),
    summary: deliveryNotes,
  };

  return {
    logisticsPlan: nextPlan,
    deliveryNotes,
  };
}

export function logisticsTaskSyncPlan(
  row: ShipmentRow,
  input: UpdateShipmentLogisticsPlanInput,
) {
  const tasks: Array<{
    taskType: "deliver_empty_box" | "pickup_full_box";
    needed: boolean;
    scheduleMode: string;
    scheduleAt: string | null;
  }> = [
    {
      taskType: "deliver_empty_box",
      needed: legDriverTaskNeeded(
        row,
        "deliver_empty_box",
        input.emptyBox.mode,
        EMPTY_BOX_DRIVER_MODE,
        input.emptyBox,
        "emptyBox",
      ),
      scheduleMode: input.emptyBox.scheduleMode || "pending",
      scheduleAt: input.emptyBox.scheduleAt || null,
    },
  ];

  if (row.sale_kind !== "empty_box_deposit" && input.fullBox) {
    tasks.push({
      taskType: "pickup_full_box",
      needed: legDriverTaskNeeded(
        row,
        "pickup_full_box",
        input.fullBox.mode,
        FULL_BOX_DRIVER_MODE,
        input.fullBox,
        "fullBox",
      ),
      scheduleMode: input.fullBox.scheduleMode || "pending",
      scheduleAt: input.fullBox.scheduleAt || null,
    });
  }

  return tasks.map((spec) => {
    const existing = syncTask(row, spec.taskType);

    return {
      ...spec,
      existing,
      canMutate: !existing || (existing.status !== "completed" && existing.status !== "cancelled"),
    };
  });
}

export function validateLogisticsPlanUpdate(row: ShipmentRow, input: UpdateShipmentLogisticsPlanInput) {
  if (emptyBoxLegLocked(row)) {
    const current = planLeg(row.logistics_plan, "emptyBox");
    const currentMode = String(current?.mode || "");
    const currentHanding = current?.handingNow === true;

    if (
      input.emptyBox.mode !== currentMode ||
      (input.emptyBox.mode === EMPTY_BOX_OFFICE_MODE && input.emptyBox.handingNow !== currentHanding)
    ) {
      return emptyBoxLegLockReason(row) || "No puedes cambiar la entrega de caja vacía.";
    }
  }

  if (fullBoxLegLocked(row) && input.fullBox) {
    const current = planLeg(row.logistics_plan, "fullBox");
    const currentMode = String(current?.mode || "");

    if (input.fullBox.mode !== currentMode) {
      return fullBoxLegLockReason(row) || "No puedes cambiar la recolección de caja llena.";
    }
  }

  if (!input.emptyBox.mode) {
    const currentEmptyBoxMode = String(planLeg(row.logistics_plan, "emptyBox")?.mode || "");

    if (currentEmptyBoxMode && !emptyBoxDeliveryCanClear(row, input)) {
      return "Elige cómo se entrega la caja vacía.";
    }
  }

  if (row.sale_kind !== "empty_box_deposit" && input.fullBox && !input.fullBox.mode) {
    const currentFullBoxMode = String(planLeg(row.logistics_plan, "fullBox")?.mode || "");

    if (currentFullBoxMode && !fullBoxPickupCanClear(row, input)) {
      return "Elige cómo se recoge la caja llena.";
    }
  }

  const taskSync = logisticsTaskSyncPlan(row, input);

  for (const item of taskSync) {
    if (!item.needed && item.existing?.status === "completed") {
      return "No puedes quitar una tarea de chofer ya completada.";
    }

    if (item.needed && item.existing?.status === "completed") {
      const legMode =
        item.taskType === "deliver_empty_box" ? input.emptyBox.mode : input.fullBox?.mode || "";

      if (legMode !== String(planLeg(row.logistics_plan, item.taskType === "deliver_empty_box" ? "emptyBox" : "fullBox")?.mode || "")) {
        return "No puedes cambiar el modo de una tarea ya completada.";
      }
    }
  }

  return "";
}

export function editorStateToUpdateInput(state: ShipmentLogisticsEditorState): UpdateShipmentLogisticsPlanInput {
  return {
    emptyBox: {
      mode: state.emptyBoxMode,
      handingNow: state.emptyBoxHandingNow,
      scheduleMode: state.emptyBoxScheduleMode,
      scheduleAt: state.emptyBoxScheduleAt || null,
      driverTaskOrdered: state.emptyBoxDriverTaskOrdered,
    },
    fullBox: {
      mode: state.fullBoxMode,
      scheduleMode: state.fullBoxScheduleMode,
      scheduleAt: state.fullBoxScheduleAt || null,
      driverTaskOrdered: state.fullBoxDriverTaskOrdered,
    },
  };
}
