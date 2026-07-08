"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Truck, Warehouse } from "lucide-react";
import { reactivateLogisticsTaskAction } from "@/app/actions/shipments";
import { DateInput } from "@/components/date-input";
import { ScheduleTimeField } from "@/components/sale/schedule-time-field";
import { InlineSearchPicker } from "@/components/inline-search-picker";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import {
  buildLogisticsTaskEditPatch,
  logisticsTaskEditDisabledReason,
  logisticsTaskEditDraftFromTask,
  logisticsTaskEditScheduleValid,
  type LogisticsTaskEditDraft,
} from "@/lib/logistics-task-edit";
import { logisticsReprogramStockNotice } from "@/lib/logistics-reprogram";
import { buildDriverPickerOptions } from "@/lib/logistics-view";
import { minScheduleDateInput } from "@/lib/schedule-date";
import type { LogisticsTaskStatus } from "@/app/actions/shipments";

type WarehouseOption = {
  id: string;
  name: string;
  is_default?: boolean;
};

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
  warehouses: WarehouseOption[];
  routeMembers: Array<{ id: string; fullName: string }>;
  onCancel: () => void;
  onSaved: () => void | Promise<void>;
};

function warehouseLabel(warehouse: WarehouseOption) {
  return warehouse.is_default ? `${warehouse.name} (principal)` : warehouse.name;
}

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
    if (open) {
      setDraft(logisticsTaskEditDraftFromTask(task));
      setAssignedTo(task.assignedTo || "");
      setError("");
    }
  }, [open, task]);

  if (!open) {
    return null;
  }

  const driverOptions = buildDriverPickerOptions(routeMembers);
  const stockNotice = logisticsReprogramStockNotice(task);
  const warehouseDisabled = Boolean(logisticsTaskEditDisabledReason(task, "warehouse"));
  const scheduleValid = logisticsTaskEditScheduleValid(draft);

  async function handleReprogram() {
    setError("");

    try {
      const patch = buildLogisticsTaskEditPatch(draft, task.scheduledAt);
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

          <div className="grid gap-2">
            <span className="text-xs font-black uppercase text-slate-500">Programación</span>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-panel p-1">
              {(
                [
                  ["pending", "Sin fecha"],
                  ["scheduled", "Con fecha"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      scheduleMode: mode,
                    }))
                  }
                  className={`h-9 rounded-md text-xs font-black transition ${
                    draft.scheduleMode === mode
                      ? "bg-emerald-400 text-slate-950"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {draft.scheduleMode === "scheduled" ? (
              <div className="grid gap-2 rounded-lg border border-black bg-surface-card p-3">
                <div className="grid gap-1">
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-slate-500">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Fecha
                  </span>
                  <DateInput
                    value={draft.routeDate}
                    min={minScheduleDateInput()}
                    onChange={(routeDate) =>
                      setDraft((current) => ({
                        ...current,
                        routeDate,
                      }))
                    }
                    ariaLabel="Fecha reprogramada"
                  />
                </div>
                <ScheduleTimeField
                  value={draft.routeTime}
                  onChange={(routeTime) =>
                    setDraft((current) => ({
                      ...current,
                      routeTime,
                    }))
                  }
                />
              </div>
            ) : null}
          </div>

          {warehouses.length > 1 ? (
            <div className="grid gap-1">
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-slate-500">
                <Warehouse className="h-3.5 w-3.5" />
                Bodega
              </span>
              <InlineSearchPicker
                value={draft.warehouseId || ""}
                onChange={(warehouseId) =>
                  setDraft((current) => ({
                    ...current,
                    warehouseId: warehouseId || null,
                  }))
                }
                options={warehouses.map((warehouse) => ({
                  value: warehouse.id,
                  label: warehouseLabel(warehouse),
                  searchText: warehouse.name,
                }))}
                placeholder="Sin bodega"
                searchPlaceholder="Buscar bodega…"
                emptyLabel="Sin bodegas"
                ariaLabel="Bodega"
                disabled={warehouseDisabled}
              />
            </div>
          ) : null}

          <label className="grid gap-1">
            <span className="text-[10px] font-black uppercase text-slate-500">Notas</span>
            <textarea
              value={draft.notes}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              rows={3}
              className="w-full rounded-lg border border-black bg-surface-inset px-3 py-2 text-sm font-bold text-[#f8fafc] outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </label>
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
