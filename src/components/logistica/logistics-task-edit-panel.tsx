"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Warehouse } from "lucide-react";
import { DateInput } from "@/components/date-input";
import { ScheduleTimeField } from "@/components/sale/schedule-time-field";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import { InlineSearchPicker } from "@/components/inline-search-picker";
import {
  buildLogisticsTaskEditPatch,
  logisticsTaskEditDisabledReason,
  logisticsTaskEditDraftFromTask,
  logisticsTaskEditScheduleValid,
  type LogisticsTaskEditDraft,
} from "@/lib/logistics-task-edit";
import { minScheduleDateInput } from "@/lib/schedule-date";
import type { LogisticsTaskStatus } from "@/app/actions/shipments";

type WarehouseOption = {
  id: string;
  name: string;
  is_default?: boolean;
};

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
  warehouses: WarehouseOption[];
  saving?: boolean;
  onCancel: () => void;
  onSave: (patch: {
    scheduledAt: string | null;
    warehouseId: string | null;
    notes: string;
  }) => void | Promise<void>;
};

function warehouseLabel(warehouse: WarehouseOption) {
  return warehouse.is_default ? `${warehouse.name} (principal)` : warehouse.name;
}

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

  useEffect(() => {
    if (open) {
      setDraft(logisticsTaskEditDraftFromTask(task));
    }
  }, [open, task]);

  if (!open) {
    return null;
  }

  const warehouseDisabled = Boolean(logisticsTaskEditDisabledReason(task, "warehouse"));
  const scheduleValid = logisticsTaskEditScheduleValid(draft);

  async function handleSave() {
    try {
      const patch = buildLogisticsTaskEditPatch(draft, task.scheduledAt);
      await onSave(patch);
    } catch {
      return;
    }
  }

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-4">
      <div
        className="w-full max-w-lg rounded-xl border border-black bg-surface-panel p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="logistics-task-edit-title"
      >
        <p id="logistics-task-edit-title" className="text-xl font-black text-[#f8fafc]">
          Editar tarea
        </p>
        <p className="mt-1 text-sm font-bold text-slate-400">
          {shipmentCode} · {customerName}
        </p>
        <p className="mt-1 text-xs font-black uppercase text-emerald-300">{taskTypeLabel}</p>

        <div className="mt-4 grid gap-4">
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
                    ariaLabel="Fecha de tarea"
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
              {warehouseDisabled ? (
                <p className="text-[11px] font-bold text-amber-300">
                  {logisticsTaskEditDisabledReason(task, "warehouse")}
                </p>
              ) : null}
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
              placeholder="Instrucciones para logística o conductor"
            />
          </label>
        </div>

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
