"use client";

import { useEffect, useState } from "react";
import { Truck } from "lucide-react";
import { reactivateLogisticsTaskAction } from "@/app/actions/shipments";
import { InlineSearchPicker } from "@/components/inline-search-picker";
import {
  LogisticsTaskEditFields,
  type LogisticsWarehouseOption,
} from "@/components/logistica/logistics-task-edit-fields";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import {
  buildLogisticsTaskEditPatch,
  logisticsTaskEditDraftFromTask,
  logisticsTaskEditScheduleValid,
  type LogisticsTaskEditDraft,
} from "@/lib/logistics-task-edit";
import { logisticsReprogramStockNotice } from "@/lib/logistics-reprogram";
import { buildDriverPickerOptions } from "@/lib/logistics-view";
import type { LogisticsTaskStatus } from "@/app/actions/shipments";

type LogisticsTaskReprogramPanelProps = {
  open: boolean;
  shipmentCode: string;
  customerName: string;
  taskTypeLabel: string;
  task: {
    id: string;
    status: LogisticsTaskStatus;
    scheduledAt: string | null;
    warehouseId: string | null;
    notes: string;
    stockDeductedAt?: string | null;
    assignedTo: string | null;
  };
  warehouses: LogisticsWarehouseOption[];
  routeMembers: Array<{ id: string; label: string }>;
  onCancel: () => void;
  onSaved: () => void | Promise<void>;
};

export function LogisticsTaskReprogramPanel({
  open,
  shipmentCode,
  customerName,
  taskTypeLabel,
  task,
  warehouses,
  routeMembers,
  onCancel,
  onSaved,
}: LogisticsTaskReprogramPanelProps) {
  const [draft, setDraft] = useState<LogisticsTaskEditDraft>(() =>
    logisticsTaskEditDraftFromTask(task),
  );
  const [assignedTo, setAssignedTo] = useState(task.assignedTo || "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || submitting) {
      return;
    }

    const closeFromEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    window.addEventListener("keydown", closeFromEscape);
    return () => window.removeEventListener("keydown", closeFromEscape);
  }, [open, submitting, onCancel]);

  if (!open) {
    return null;
  }

  const driverOptions = buildDriverPickerOptions(routeMembers, "Sin chofer");
  const stockNotice = logisticsReprogramStockNotice(task);
  const scheduleValid = logisticsTaskEditScheduleValid(draft);

  async function handleReprogram() {
    setError("");

    try {
      const patch = buildLogisticsTaskEditPatch(draft);
      setSubmitting(true);
      const result = await reactivateLogisticsTaskAction({
        taskId: task.id,
        scheduledAt: patch.scheduledAt,
        assignedTo: assignedTo || null,
        warehouseId: patch.warehouseId,
        notes: patch.notes,
      });
      setSubmitting(false);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      await onSaved();
    } catch (caught) {
      setSubmitting(false);
      setError(caught instanceof Error ? caught.message : "No se pudo reprogramar");
    }
  }

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-4">
      <div
        className="w-full max-w-lg rounded-xl border border-black bg-surface-panel p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="logistics-task-reprogram-title"
      >
        <p id="logistics-task-reprogram-title" className="text-xl font-black text-[#f8fafc]">
          Reprogramar tarea
        </p>
        <p className="mt-1 text-sm font-bold text-slate-400">
          {shipmentCode} · {customerName}
        </p>
        <p className="mt-1 text-xs font-black uppercase text-amber-300">{taskTypeLabel}</p>

        {stockNotice ? (
          <p className="mt-3 rounded-lg border border-amber-900/70 bg-amber-400/10 px-3 py-2 text-sm font-black text-amber-100">
            {stockNotice}
          </p>
        ) : null}

        <div className="mt-4 grid gap-4">
          <div className="grid gap-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-slate-500">
              <Truck className="h-3.5 w-3.5" />
              Chofer
            </span>
            <InlineSearchPicker
              value={assignedTo}
              onChange={setAssignedTo}
              options={driverOptions}
              placeholder="Sin asignar"
              searchPlaceholder="Buscar chofer…"
              emptyLabel="Sin conductores"
              ariaLabel="Chofer reprogramado"
            />
          </div>

          <LogisticsTaskEditFields
            draft={draft}
            setDraft={setDraft}
            task={task}
            warehouses={warehouses}
            dateAriaLabel="Fecha reprogramada"
          />
        </div>

        {error ? (
          <p className="mt-3 text-sm font-black text-rose-300">{error}</p>
        ) : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className={`${secondaryButtonClass} h-11 text-sm font-black disabled:opacity-40`}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleReprogram()}
            disabled={submitting || !scheduleValid}
            className={`${primaryButtonClass} h-11 text-sm font-black disabled:opacity-40`}
          >
            {submitting ? "Reprogramando…" : "Reprogramar"}
          </button>
        </div>
      </div>
    </div>
  );
}
