"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck2, Route, Truck } from "lucide-react";
import { DateInput } from "@/components/date-input";
import { InlineSearchPicker } from "@/components/inline-search-picker";
import { TimePickerInput } from "@/components/time-picker-input";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import { logisticsWeekdayKeys } from "@/lib/logistics-route-catalog";
import {
  dateMatchesLogisticsWeekday,
  getLogisticsWeekdayIndex,
  nextDateForLogisticsWeekday,
} from "@/lib/logistics-route-week";
import { minScheduleDateInput } from "@/lib/schedule-date";
import { scheduleAtToTimestamp } from "@/lib/sale/schedule-time";
import { isoToPlanScheduleAt } from "@/lib/shipment-schedule-history";

type RouteTemplate = { id: string; weekday: number; name: string };
type Driver = { id: string; label: string; roleSlug: string };
type SelectionOrder = "date-first" | "route-first";

function scheduleDraft(scheduledAt: string | null) {
  if (!scheduledAt) {
    return { date: minScheduleDateInput(), time: "10:00" };
  }

  const [date = minScheduleDateInput(), time = "10:00"] = isoToPlanScheduleAt(scheduledAt).split("T");
  return { date, time: time.slice(0, 5) || "10:00" };
}

function templateLabel(template: RouteTemplate) {
  const day = logisticsWeekdayKeys[template.weekday] || `Día ${template.weekday}`;
  return `${day} · ${template.name}`;
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
  title = "Confirmar y programar",
  confirmLabel = "Confirmar y programar",
  selectionOrder = "date-first",
  allowPendingRoute = false,
  pendingRouteLabel = "No sé la ruta todavía",
  onCancel,
  onConfirm,
  onConfirmPendingRoute,
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
  title?: string;
  confirmLabel?: string;
  selectionOrder?: SelectionOrder;
  allowPendingRoute?: boolean;
  pendingRouteLabel?: string;
  onCancel: () => void;
  onConfirm: (input: { scheduledAt: string; driverId: string; routeTemplateId: string }) => void | Promise<void>;
  onConfirmPendingRoute?: () => void | Promise<void>;
}) {
  const routeFirst = selectionOrder === "route-first";
  const initialDraft = scheduleDraft(scheduledAt);
  const initialWeekday = getLogisticsWeekdayIndex(initialDraft.date);
  const initialTemplate =
    templates.find((template) => template.weekday === initialWeekday) || templates[0] || null;
  const [draft, setDraft] = useState(() => {
    if (!routeFirst || !initialTemplate) {
      return initialDraft;
    }
    return {
      ...initialDraft,
      date: dateMatchesLogisticsWeekday(initialDraft.date, initialTemplate.weekday)
        ? initialDraft.date
        : nextDateForLogisticsWeekday(initialTemplate.weekday, minScheduleDateInput()),
    };
  });
  const [routeTemplateId, setRouteTemplateId] = useState(initialTemplate?.id || "");
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === routeTemplateId) || null,
    [routeTemplateId, templates],
  );
  const weekday = selectedTemplate
    ? Number(selectedTemplate.weekday)
    : getLogisticsWeekdayIndex(draft.date);
  const [driverId, setDriverId] = useState(defaultDriverByWeekday[weekday] || "");

  const dayTemplates = useMemo(
    () => (routeFirst ? templates : templates.filter((template) => template.weekday === weekday)),
    [routeFirst, templates, weekday],
  );
  const templateOptions = useMemo(
    () =>
      dayTemplates.map((template) => ({
        value: template.id,
        label: routeFirst ? templateLabel(template) : template.name,
        searchText: `${logisticsWeekdayKeys[template.weekday] || ""} ${template.name}`,
      })),
    [dayTemplates, routeFirst],
  );
  const driverOptions = useMemo(
    () =>
      routeMembers
        .filter((member) => member.roleSlug === "conductor")
        .map((member) => ({ value: member.id, label: member.label, searchText: member.label })),
    [routeMembers],
  );
  const allowedWeekdays = selectedTemplate ? [Number(selectedTemplate.weekday)] : undefined;

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

  function selectRouteTemplate(nextTemplateId: string) {
    setRouteTemplateId(nextTemplateId);
    const template = templates.find((entry) => entry.id === nextTemplateId);
    if (!template) {
      return;
    }

    const nextWeekday = Number(template.weekday);
    setDriverId(defaultDriverByWeekday[nextWeekday] || "");
    setDraft((current) => ({
      ...current,
      date: dateMatchesLogisticsWeekday(current.date, nextWeekday)
        ? current.date
        : nextDateForLogisticsWeekday(nextWeekday, minScheduleDateInput()),
    }));
  }

  if (!open) return null;

  const scheduledTimestamp = scheduleAtToTimestamp(`${draft.date}T${draft.time}`);
  const dateMatchesRoute =
    !selectedTemplate || dateMatchesLogisticsWeekday(draft.date, selectedTemplate.weekday);
  const canConfirm = Boolean(
    scheduledTimestamp && driverId && routeTemplateId && dayTemplates.length && dateMatchesRoute,
  );

  const routeField = (
    <label className="grid gap-1">
      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-slate-500">
        <Route className="h-3.5 w-3.5" /> {routeFirst ? "Ruta" : "Ruta del dia"}
      </span>
      <InlineSearchPicker
        value={routeTemplateId}
        onChange={selectRouteTemplate}
        options={templateOptions}
        placeholder="Selecciona una ruta"
        searchPlaceholder="Buscar ruta..."
        emptyLabel={routeFirst ? "No hay rutas semanales" : "No hay rutas para ese dia"}
        ariaLabel="Ruta semanal"
      />
      {routeFirst && selectedTemplate ? (
        <span className="text-[11px] font-bold text-slate-500">
          Solo se pueden elegir fechas de {logisticsWeekdayKeys[selectedTemplate.weekday] || "ese día"}.
        </span>
      ) : null}
    </label>
  );

  const dateTimeFields = (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="grid gap-1">
        <span className="text-[10px] font-black uppercase text-slate-500">
          {routeFirst ? "Qué día de esa ruta" : "Fecha"}
        </span>
        <DateInput
          value={draft.date}
          min={minScheduleDateInput()}
          allowedWeekdays={routeFirst ? allowedWeekdays : undefined}
          disabled={routeFirst && !selectedTemplate}
          onChange={(date) => {
            if (routeFirst) {
              setDraft((current) => ({ ...current, date }));
              return;
            }
            const nextWeekday = getLogisticsWeekdayIndex(date);
            setDraft((current) => ({ ...current, date }));
            setDriverId(defaultDriverByWeekday[nextWeekday] || "");
            setRouteTemplateId(templates.find((template) => template.weekday === nextWeekday)?.id || "");
          }}
          ariaLabel={routeFirst ? "Día de la ruta" : "Fecha confirmada"}
        />
      </label>
      <label className="grid gap-1">
        <span className="text-[10px] font-black uppercase text-slate-500">Hora</span>
        <TimePickerInput
          value={draft.time}
          onChange={(time) => setDraft((current) => ({ ...current, time }))}
          ariaLabel="Hora confirmada"
        />
      </label>
    </div>
  );

  return (
    <div className="app-modal-overlay fixed inset-0 z-[145] flex justify-center bg-black/70 p-3 sm:p-4">
      <div
        className="app-modal-content w-full max-w-lg rounded-xl border border-black bg-surface-panel p-4 shadow-2xl sm:p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-task-schedule-title"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-700 bg-emerald-400 text-slate-950">
            <CalendarCheck2 className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p id="confirm-task-schedule-title" className="text-xl font-black text-[#f8fafc]">
              {title}
            </p>
            <p className="mt-1 break-words text-sm font-bold text-slate-400">
              {shipmentCode} - {customerName}
            </p>
            <p className="mt-1 text-xs font-black uppercase text-emerald-300">{taskTypeLabel}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          {routeFirst ? (
            <>
              {routeField}
              {dateTimeFields}
            </>
          ) : (
            <>
              {dateTimeFields}
              {routeField}
            </>
          )}

          <label className="grid gap-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-slate-500">
              <Truck className="h-3.5 w-3.5" /> Conductor
            </span>
            <InlineSearchPicker
              value={driverId}
              onChange={setDriverId}
              options={driverOptions}
              placeholder="Selecciona un conductor"
              searchPlaceholder="Buscar conductor..."
              emptyLabel="Sin conductores"
              ariaLabel="Conductor confirmado"
            />
            {defaultDriverByWeekday[weekday] ? (
              <span className="text-[11px] font-bold text-slate-500">
                Se seleccionó el conductor predeterminado de este día; puedes cambiarlo.
              </span>
            ) : null}
          </label>
        </div>

        <div className="mt-5 grid gap-3">
          {allowPendingRoute && onConfirmPendingRoute ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void onConfirmPendingRoute()}
              className={`${secondaryButtonClass} h-11 w-full text-sm font-black disabled:opacity-40`}
            >
              {pendingRouteLabel}
            </button>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
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
              disabled={saving || !canConfirm}
              onClick={() =>
                scheduledTimestamp &&
                void onConfirm({ scheduledAt: scheduledTimestamp, driverId, routeTemplateId })
              }
              className={`${primaryButtonClass} h-11 text-sm font-black disabled:opacity-40`}
            >
              {saving ? "Confirmando..." : confirmLabel}
            </button>
          </div>
          {allowPendingRoute ? (
            <p className="text-center text-[11px] font-bold text-slate-500">
              Sin ruta queda listo para logística, pendiente de asignar día.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
