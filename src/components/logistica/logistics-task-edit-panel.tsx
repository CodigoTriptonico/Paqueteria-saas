"use client";

import { useEffect, useState } from "react";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import {
  LogisticsTaskEditFields,
  type LogisticsWarehouseOption,
} from "@/components/logistica/logistics-task-edit-fields";
import {
  buildLogisticsTaskEditPatch,
  logisticsTaskEditDraftFromTask,
  logisticsTaskEditScheduleValid,
  type LogisticsTaskEditDraft,
} from "@/lib/logistics-task-edit";
import type { LogisticsTaskStatus } from "@/app/actions/shipments";

type LogisticsTaskEditPanelProps = {
  open: boolean;
  shipmentCode: string;
  customerName: string;
  taskTypeLabel: string;
  task: {
    status: LogisticsTaskStatus;
    scheduledAt: string | null;
    warehouseId: string | null;
    notes: string;
    stockDeductedAt?: string | null;
  };
  warehouses: LogisticsWarehouseOption[];
  saving?: boolean;
  onCancel: () => void;
  onSave: (patch: {
    scheduledAt: string | null;
    warehouseId: string | null;
    notes: string;
  }) => void | Promise<void>;
};

export function LogisticsTaskEditPanel({
  open,
  shipmentCode,
  customerName,
  taskTypeLabel,
  task,
  warehouses,
  saving = false,
  onCancel,
  onSave,
}: LogisticsTaskEditPanelProps) {
  const [draft, setDraft] = useState<LogisticsTaskEditDraft>(() =>
    logisticsTaskEditDraftFromTask(task),
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || saving) {
      return;
    }

    const closeFromEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    window.addEventListener("keydown", closeFromEscape);
    return () => window.removeEventListener("keydown", closeFromEscape);
  }, [open, saving, onCancel]);

  if (!open) {
    return null;
  }

  const scheduleValid = logisticsTaskEditScheduleValid(draft);

  async function handleSave() {
    setError("");

    try {
      const patch = buildLogisticsTaskEditPatch(draft);
      await onSave(patch);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar la tarea");
    }
  }

  return (
    <div className="app-modal-overlay fixed inset-0 z-[140] flex justify-center bg-black/70 p-3 sm:p-4">
      <div
        className="app-modal-content w-full max-w-lg rounded-xl border border-black bg-surface-panel p-4 shadow-2xl sm:p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="logistics-task-edit-title"
      >
        <p id="logistics-task-edit-title" className="text-xl font-black text-[#f8fafc]">
          Editar tarea
        </p>
        <p className="mt-1 break-words text-sm font-bold text-slate-400">
          {shipmentCode} · {customerName}
        </p>
        <p className="mt-1 text-xs font-black uppercase text-emerald-300">{taskTypeLabel}</p>

        <div className="mt-4 grid gap-4">
          <LogisticsTaskEditFields
            draft={draft}
            setDraft={setDraft}
            task={task}
            warehouses={warehouses}
            dateAriaLabel="Fecha de tarea"
            notesPlaceholder="Instrucciones para logística o conductor"
            showWarehouseDisabledReason
          />
        </div>

        {error ? (
          <p className="mt-3 text-sm font-black text-rose-300">{error}</p>
        ) : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className={`${secondaryButtonClass} h-11 text-sm font-black disabled:opacity-40`}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !scheduleValid}
            className={`${primaryButtonClass} h-11 text-sm font-black disabled:opacity-40`}
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
