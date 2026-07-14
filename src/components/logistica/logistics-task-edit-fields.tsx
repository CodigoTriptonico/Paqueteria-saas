"use client";

import type { Dispatch, SetStateAction } from "react";
import { CalendarDays, Warehouse } from "lucide-react";
import type { LogisticsTaskStatus } from "@/app/actions/shipments";
import { DateInput } from "@/components/date-input";
import { InlineSearchPicker } from "@/components/inline-search-picker";
import { ScheduleTimeField } from "@/components/sale/schedule-time-field";
import {
  logisticsTaskEditDisabledReason,
  type LogisticsTaskEditDraft,
} from "@/lib/logistics-task-edit";
import { minScheduleDateInput } from "@/lib/schedule-date";

export type LogisticsWarehouseOption = {
  id: string;
  name: string;
  is_default?: boolean;
};

type LogisticsTaskEditFieldsProps = {
  draft: LogisticsTaskEditDraft;
  setDraft: Dispatch<SetStateAction<LogisticsTaskEditDraft>>;
  task: {
    status: LogisticsTaskStatus;
    stockDeductedAt?: string | null;
  };
  warehouses: LogisticsWarehouseOption[];
  dateAriaLabel: string;
  notesPlaceholder?: string;
  showWarehouseDisabledReason?: boolean;
};

function warehouseLabel(warehouse: LogisticsWarehouseOption) {
  return warehouse.is_default ? `${warehouse.name} (principal)` : warehouse.name;
}

export function LogisticsTaskEditFields({
  draft,
  setDraft,
  task,
  warehouses,
  dateAriaLabel,
  notesPlaceholder,
  showWarehouseDisabledReason = false,
}: LogisticsTaskEditFieldsProps) {
  const warehouseDisabledReason = logisticsTaskEditDisabledReason(task, "warehouse");

  return (
    <>
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
                ariaLabel={dateAriaLabel}
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
            disabled={Boolean(warehouseDisabledReason)}
          />
          {showWarehouseDisabledReason && warehouseDisabledReason ? (
            <p className="text-[11px] font-bold text-amber-300">
              {warehouseDisabledReason}
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
          placeholder={notesPlaceholder}
        />
      </label>
    </>
  );
}
