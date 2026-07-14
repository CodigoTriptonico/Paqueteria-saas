"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck2, Route, Truck } from "lucide-react";
import { DateInput } from "@/components/date-input";
import { InlineSearchPicker } from "@/components/inline-search-picker";
import { TimePickerInput } from "@/components/time-picker-input";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import { getLogisticsWeekdayIndex } from "@/lib/logistics-route-week";
import { minScheduleDateInput } from "@/lib/schedule-date";
import { scheduleAtToTimestamp } from "@/lib/sale/schedule-time";
import { isoToPlanScheduleAt } from "@/lib/shipment-schedule-history";

type RouteTemplate = { id: string; weekday: number; name: string };
type Driver = { id: string; label: string; roleSlug: string };

function scheduleDraft(scheduledAt: string | null) {
  if (!scheduledAt) {
    return { date: minScheduleDateInput(), time: "10:00" };
  }

  const [date = minScheduleDateInput(), time = "10:00"] = isoToPlanScheduleAt(scheduledAt).split("T");
  return { date, time: time.slice(0, 5) || "10:00" };
}

export function LogisticsTaskScheduleConfirmPanel({
  open,
  shipmentCode,
  customerName,
  taskTypeLabel,
  scheduledAt,
  templates,
  defaultDriverByWeekday,
  routeMembers,
  saving = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  shipmentCode: string;
  customerName: string;
  taskTypeLabel: string;
  scheduledAt: string | null;
  templates: RouteTemplate[];
  defaultDriverByWeekday: Array<string | null>;
  routeMembers: Driver[];
  saving?: boolean;
  onCancel: () => void;
  onConfirm: (input: { scheduledAt: string; driverId: string; routeTemplateId: string }) => void | Promise<void>;
}) {
  const initialDraft = scheduleDraft(scheduledAt);
  const initialWeekday = getLogisticsWeekdayIndex(initialDraft.date);
  const [draft, setDraft] = useState(initialDraft);
  const [driverId, setDriverId] = useState(defaultDriverByWeekday[initialWeekday] || "");
  const [routeTemplateId, setRouteTemplateId] = useState(
    templates.find((template) => template.weekday === initialWeekday)?.id || "",
  );
  const weekday = getLogisticsWeekdayIndex(draft.date);
  const dayTemplates = useMemo(
    () => templates.filter((template) => template.weekday === weekday),
    [templates, weekday],
  );
  const driverOptions = useMemo(
    () =>
      routeMembers
        .filter((member) => member.roleSlug === "conductor")
        .map((member) => ({ value: member.id, label: member.label, searchText: member.label })),
    [routeMembers],
  );

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

  if (!open) return null;

  const scheduledTimestamp = scheduleAtToTimestamp(`${draft.date}T${draft.time}`);
  const canConfirm = Boolean(scheduledTimestamp && driverId && routeTemplateId && dayTemplates.length);

  return (
    <div className="fixed inset-0 z-[145] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-xl border border-black bg-surface-panel p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="confirm-task-schedule-title">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-700 bg-emerald-400 text-slate-950">
            <CalendarCheck2 className="h-5 w-5" />
          </span>
          <div>
            <p id="confirm-task-schedule-title" className="text-xl font-black text-[#f8fafc]">Confirmar y programar</p>
            <p className="mt-1 text-sm font-bold text-slate-400">{shipmentCode} - {customerName}</p>
            <p className="mt-1 text-xs font-black uppercase text-emerald-300">{taskTypeLabel}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-[10px] font-black uppercase text-slate-500">Fecha</span>
              <DateInput
                value={draft.date}
                min={minScheduleDateInput()}
                onChange={(date) => {
                  const nextWeekday = getLogisticsWeekdayIndex(date);
                  setDraft((current) => ({ ...current, date }));
                  setDriverId(defaultDriverByWeekday[nextWeekday] || "");
                  setRouteTemplateId(templates.find((template) => template.weekday === nextWeekday)?.id || "");
                }}
                ariaLabel="Fecha confirmada"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-[10px] font-black uppercase text-slate-500">Hora</span>
              <TimePickerInput value={draft.time} onChange={(time) => setDraft((current) => ({ ...current, time }))} ariaLabel="Hora confirmada" />
            </label>
          </div>

          <label className="grid gap-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-slate-500"><Route className="h-3.5 w-3.5" /> Ruta del dia</span>
            <InlineSearchPicker value={routeTemplateId} onChange={setRouteTemplateId} options={dayTemplates.map((template) => ({ value: template.id, label: template.name, searchText: template.name }))} placeholder="Selecciona una ruta" searchPlaceholder="Buscar ruta..." emptyLabel="No hay rutas para ese dia" ariaLabel="Ruta semanal" />
          </label>

          <label className="grid gap-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-slate-500"><Truck className="h-3.5 w-3.5" /> Conductor</span>
            <InlineSearchPicker value={driverId} onChange={setDriverId} options={driverOptions} placeholder="Selecciona un conductor" searchPlaceholder="Buscar conductor..." emptyLabel="Sin conductores" ariaLabel="Conductor confirmado" />
            {defaultDriverByWeekday[weekday] ? <span className="text-[11px] font-bold text-slate-500">Se seleccionó el conductor predeterminado de este día; puedes cambiarlo.</span> : null}
          </label>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={onCancel} disabled={saving} className={`${secondaryButtonClass} h-11 text-sm font-black disabled:opacity-40`}>Cancelar</button>
          <button type="button" disabled={saving || !canConfirm} onClick={() => scheduledTimestamp && void onConfirm({ scheduledAt: scheduledTimestamp, driverId, routeTemplateId })} className={`${primaryButtonClass} h-11 text-sm font-black disabled:opacity-40`}>
            {saving ? "Confirmando..." : "Confirmar y programar"}
          </button>
        </div>
      </div>
    </div>
  );
}
