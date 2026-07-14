import type { LogisticsTaskStatus } from "@/app/actions/shipments";
import { formatScheduleDateInput } from "@/lib/schedule-date";
import { scheduleAtToTimestamp, scheduleTimeComplete } from "@/lib/sale/schedule-time";
import { isoToPlanScheduleAt } from "@/lib/shipment-schedule-history";
import { isClosedLogisticsStatus } from "@/lib/logistics-view";

export type LogisticsTaskEditableField = "schedule" | "warehouse" | "notes";

type LogisticsTaskEditScheduleMode = "pending" | "scheduled";

export type LogisticsTaskEditDraft = {
  scheduleMode: LogisticsTaskEditScheduleMode;
  routeDate: string;
  routeTime: string;
  warehouseId: string | null;
  notes: string;
};

export function canEditLogisticsTaskFields(task: {
  status: LogisticsTaskStatus;
}): boolean {
  return !isClosedLogisticsStatus(task.status);
}

export function logisticsTaskEditDisabledReason(
  task: {
    status: LogisticsTaskStatus;
    stockDeductedAt?: string | null;
  },
  field: LogisticsTaskEditableField,
): string | null {
  if (isClosedLogisticsStatus(task.status)) {
    return "Tarea cerrada";
  }

  if (field === "warehouse" && task.stockDeductedAt) {
    return "Stock ya descontado de bodega";
  }

  return null;
}

export function logisticsTaskEditDraftFromTask(task: {
  scheduledAt: string | null;
  warehouseId: string | null;
  notes: string;
}): LogisticsTaskEditDraft {
  if (!task.scheduledAt) {
    return {
      scheduleMode: "pending",
      routeDate: formatScheduleDateInput(new Date()),
      routeTime: "10:00",
      warehouseId: task.warehouseId,
      notes: task.notes || "",
    };
  }

  const planScheduleAt = isoToPlanScheduleAt(task.scheduledAt);
  const [routeDate = formatScheduleDateInput(new Date()), routeTime = "10:00"] =
    planScheduleAt.split("T");

  return {
    scheduleMode: "scheduled",
    routeDate,
    routeTime,
    warehouseId: task.warehouseId,
    notes: task.notes || "",
  };
}

export function buildLogisticsTaskEditPatch(
  draft: LogisticsTaskEditDraft,
): {
  scheduledAt: string | null;
  warehouseId: string | null;
  notes: string;
} {
  if (draft.scheduleMode === "pending") {
    return {
      scheduledAt: null,
      warehouseId: draft.warehouseId,
      notes: draft.notes.trim(),
    };
  }

  const scheduleAt = `${draft.routeDate}T${draft.routeTime}`;
  const scheduledAt = scheduleAtToTimestamp(scheduleAt);

  if (!scheduledAt) {
    throw new Error("Fecha u hora invalida");
  }

  if (!scheduleTimeComplete(draft.routeTime)) {
    throw new Error("Completa la hora de la cita");
  }

  return {
    scheduledAt,
    warehouseId: draft.warehouseId,
    notes: draft.notes.trim(),
  };
}

export function logisticsTaskEditScheduleValid(draft: LogisticsTaskEditDraft): boolean {
  if (draft.scheduleMode === "pending") {
    return true;
  }

  if (!draft.routeDate) {
    return false;
  }

  return scheduleTimeComplete(draft.routeTime);
}
