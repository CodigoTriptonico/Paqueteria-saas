"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck2, Route, Truck } from "lucide-react";
import { ensureLogisticsDayRouteTemplateAction } from "@/app/actions/logistics-routes";
import { DateInput } from "@/components/date-input";
import { InlineSearchPicker } from "@/components/inline-search-picker";
import { LogisticsWeekdayPicker } from "@/components/logistica/logistics-weekday-picker";
import { TimePickerInput } from "@/components/time-picker-input";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import { useNotify } from "@/hooks/use-notify";
import { logisticsWeekdayKeys, type LogisticsWeekdayKey } from "@/lib/logistics-route-catalog";
import {
  dayAsRouteHint,
  enabledWeekdayIndexes,
  isDayAsRouteTemplateId,
  nextWeekdayScheduleHint,
  resolveDayRouteTemplateId,
  selectWeekdayDate,
} from "@/lib/logistics-day-route";
import { resolveScheduleConfirmDriverId } from "@/lib/logistics-schedule-confirm-driver";
import {
  dateMatchesLogisticsWeekday,
  getLogisticsWeekdayIndex,
  nextDateForAvailableWeekdays,
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
  enabledDays = [],
  defaultDriverByWeekday,
  routeMembers,
  saving = false,
  title = "Confirmar y programar",
  confirmLabel = "Confirmar y programar",
  selectionOrder = "date-first",
  showDriverPicker = true,
  allowPendingRoute = false,
  pendingRouteLabel = "No sé la ruta todavía",
  pendingRouteDate = null,
  requireExplicitRouteSelection = false,
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
  /** Catalog-enabled weekdays. When a day has 0 templates, the day itself is the route. */
  enabledDays?: LogisticsWeekdayKey[];
  defaultDriverByWeekday: Array<string | null>;
  routeMembers: Driver[];
  saving?: boolean;
  title?: string;
  confirmLabel?: string;
  selectionOrder?: SelectionOrder;
  /** Sellers assign day+route; logistics owns the driver. */
  showDriverPicker?: boolean;
  allowPendingRoute?: boolean;
  pendingRouteLabel?: string;
  pendingRouteDate?: string | null;
  requireExplicitRouteSelection?: boolean;
  onCancel: () => void;
  onConfirm: (input: {
    scheduledAt: string;
    driverId: string;
    routeTemplateId: string;
  }) => void | Promise<void>;
  onConfirmPendingRoute?: (input: { routeDate: string }) => void | Promise<void>;
}) {
  const notify = useNotify();
  const routeFirst = selectionOrder === "route-first";
  const availableWeekdays = useMemo(
    () => enabledWeekdayIndexes(enabledDays),
    [enabledDays],
  );
  const initialScheduleDraft = scheduleDraft(scheduledAt);
  const initialDraft =
    /^\d{4}-\d{2}-\d{2}$/.test(String(pendingRouteDate || ""))
      ? { ...initialScheduleDraft, date: String(pendingRouteDate) }
      : initialScheduleDraft;
  const initialWeekday = getLogisticsWeekdayIndex(initialDraft.date);
  const initialTemplate =
    templates.find((template) => Number(template.weekday) === initialWeekday) ||
    templates.find((template) => availableWeekdays.includes(Number(template.weekday))) ||
    templates[0] ||
    null;
  const [draft, setDraft] = useState(() => {
    if (routeFirst) {
      if (!initialTemplate) {
        return initialDraft;
      }
      return {
        ...initialDraft,
        date: dateMatchesLogisticsWeekday(initialDraft.date, initialTemplate.weekday)
          ? initialDraft.date
          : nextDateForLogisticsWeekday(initialTemplate.weekday, minScheduleDateInput()),
      };
    }

    const fallbackDate = nextDateForAvailableWeekdays(availableWeekdays, minScheduleDateInput());
    return {
      ...initialDraft,
      date: availableWeekdays.includes(getLogisticsWeekdayIndex(initialDraft.date))
        ? initialDraft.date
        : fallbackDate,
    };
  });
  const [routeTemplateId, setRouteTemplateId] = useState(() => {
    if (routeFirst) {
      return initialTemplate?.id || "";
    }
    const fallbackDate = nextDateForAvailableWeekdays(availableWeekdays, minScheduleDateInput());
    const startDate = availableWeekdays.includes(getLogisticsWeekdayIndex(initialDraft.date))
      ? initialDraft.date
      : fallbackDate;
    const startWeekday = getLogisticsWeekdayIndex(startDate);
    const resolvedTemplateId = resolveDayRouteTemplateId({ weekday: startWeekday, templates });
    return requireExplicitRouteSelection && !isDayAsRouteTemplateId(resolvedTemplateId)
      ? ""
      : resolvedTemplateId;
  });
  const [ensuringDayRoute, setEnsuringDayRoute] = useState(false);
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === routeTemplateId) || null,
    [routeTemplateId, templates],
  );
  const weekday = routeFirst
    ? selectedTemplate
      ? Number(selectedTemplate.weekday)
      : getLogisticsWeekdayIndex(draft.date)
    : getLogisticsWeekdayIndex(draft.date);
  const [driverId, setDriverId] = useState(defaultDriverByWeekday[weekday] || "");
  const resolvedDriverId = resolveScheduleConfirmDriverId({
    showDriverPicker,
    selectedDriverId: driverId,
    defaultDriverId: defaultDriverByWeekday[weekday],
    conductors: routeMembers,
  });

  const dayTemplates = useMemo(
    () =>
      routeFirst
        ? templates
        : templates.filter((template) => Number(template.weekday) === weekday),
    [routeFirst, templates, weekday],
  );
  const dayAsRoute = !routeFirst && dayTemplates.length === 0 && availableWeekdays.includes(weekday);
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
    () => [
      { value: "", label: "Sin conductor todavía", searchText: "sin conductor" },
      ...routeMembers
        .filter((member) => member.roleSlug === "conductor")
        .map((member) => ({ value: member.id, label: member.label, searchText: member.label })),
    ],
    [routeMembers],
  );
  const allowedWeekdays = routeFirst
    ? selectedTemplate
      ? [Number(selectedTemplate.weekday)]
      : undefined
    : availableWeekdays;
  const weekdayLabel = logisticsWeekdayKeys[weekday] || "";
  const dateHint = nextWeekdayScheduleHint(draft.date);

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
    if (routeFirst) {
      setDraft((current) => ({
        ...current,
        date: dateMatchesLogisticsWeekday(current.date, nextWeekday)
          ? current.date
          : nextDateForLogisticsWeekday(nextWeekday, minScheduleDateInput()),
      }));
    }
  }

  function routeTemplateForWeekday(nextWeekday: number, currentTemplateId?: string) {
    const resolvedTemplateId = resolveDayRouteTemplateId({
      weekday: nextWeekday,
      templates,
      currentTemplateId,
    });

    return requireExplicitRouteSelection && !isDayAsRouteTemplateId(resolvedTemplateId)
      ? ""
      : resolvedTemplateId;
  }

  function selectDate(date: string) {
    if (routeFirst) {
      setDraft((current) => ({ ...current, date }));
      return;
    }

    const nextWeekday = getLogisticsWeekdayIndex(date);
    setDraft((current) => ({ ...current, date }));
    setDriverId(defaultDriverByWeekday[nextWeekday] || "");
    setRouteTemplateId((current) => routeTemplateForWeekday(nextWeekday, current));
  }

  function selectWeekday(nextWeekday: number) {
    const date = selectWeekdayDate(nextWeekday, minScheduleDateInput());
    setDraft((current) => ({ ...current, date }));
    setDriverId(defaultDriverByWeekday[nextWeekday] || "");
    setRouteTemplateId((current) => routeTemplateForWeekday(nextWeekday, current));
  }

  if (!open) return null;

  const scheduledTimestamp = scheduleAtToTimestamp(`${draft.date}T${draft.time}`);
  const dateMatchesRoute =
    !selectedTemplate || dateMatchesLogisticsWeekday(draft.date, selectedTemplate.weekday);
  // Day + route are enough; driver can be assigned later after filtering by route.
  const canConfirm = Boolean(
    scheduledTimestamp &&
      (dayAsRoute
        ? isDayAsRouteTemplateId(routeTemplateId)
        : routeTemplateId && dayTemplates.length) &&
      dateMatchesRoute,
  );
  const canLeavePendingRoute = Boolean(
    /^\d{4}-\d{2}-\d{2}$/.test(draft.date) && availableWeekdays.includes(weekday),
  );
  const showTimeField = Boolean(dayAsRoute || routeTemplateId);

  const routeField = (
    <div className="grid gap-1">
      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-slate-500">
        <Route className="h-3.5 w-3.5" /> {routeFirst ? "Ruta" : "Ruta del día"}
      </span>
      {dayAsRoute ? (
        <div className="rounded-lg border border-black bg-surface-inset px-3 py-2.5">
          <p className="text-sm font-black text-[#f8fafc]">{weekdayLabel || "Día"}</p>
          <p className="mt-0.5 text-[11px] font-bold text-slate-500">{dayAsRouteHint(weekday)}</p>
        </div>
      ) : (
        <InlineSearchPicker
          value={routeTemplateId}
          onChange={selectRouteTemplate}
          options={templateOptions}
          placeholder={
            routeFirst
              ? "Selecciona una ruta"
              : dayTemplates.length
                ? `Rutas de ${weekdayLabel}`
                : "No hay rutas ese día"
          }
          searchPlaceholder="Buscar ruta..."
          emptyLabel={routeFirst ? "No hay rutas semanales" : `No hay rutas para ${weekdayLabel || "ese día"}`}
          ariaLabel="Ruta semanal"
          className="w-full"
          minWidthClass="w-full"
        />
      )}
      {!routeFirst && !dayAsRoute && weekdayLabel ? (
        <span className="text-[11px] font-bold text-slate-500">
          Solo aparecen rutas de {weekdayLabel}.
        </span>
      ) : null}
      {routeFirst && selectedTemplate ? (
        <span className="text-[11px] font-bold text-slate-500">
          Solo se pueden elegir fechas de {logisticsWeekdayKeys[selectedTemplate.weekday] || "ese día"}.
        </span>
      ) : null}
    </div>
  );

  const dateField = routeFirst ? (
    <div className="grid gap-1">
      <span className="text-[10px] font-black uppercase text-slate-500">Qué día de esa ruta</span>
      <DateInput
        value={draft.date}
        min={minScheduleDateInput()}
        allowedWeekdays={allowedWeekdays}
        disabled={!selectedTemplate}
        onChange={selectDate}
        ariaLabel="Día de la ruta"
        className="w-full"
      />
      {weekdayLabel ? (
        <span className="text-[11px] font-bold text-slate-500">{weekdayLabel}</span>
      ) : null}
    </div>
  ) : (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <span className="text-[10px] font-black uppercase text-slate-500">Día</span>
        <LogisticsWeekdayPicker
          value={weekday}
          availableWeekdays={availableWeekdays}
          disabled={availableWeekdays.length === 0}
          onChange={selectWeekday}
          ariaLabel="Día de entrega"
        />
        {availableWeekdays.length === 0 ? (
          <span className="text-[11px] font-bold text-amber-200">
            No hay días disponibles en el calendario de rutas.
          </span>
        ) : (
          <span className="text-[11px] font-bold text-slate-500">
            Elige el día de la semana; abajo eliges cuál fecha.
          </span>
        )}
      </div>
      <div className="grid gap-1">
        <span className="text-[10px] font-black uppercase text-slate-500">Fecha</span>
        <DateInput
          value={draft.date}
          min={minScheduleDateInput()}
          allowedWeekdays={
            availableWeekdays.includes(weekday) ? [weekday] : availableWeekdays
          }
          disabled={availableWeekdays.length === 0}
          onChange={selectDate}
          ariaLabel="Fecha de entrega"
          className="w-full"
        />
        {availableWeekdays.length === 0 ? null : dateHint ? (
          <span className="text-[11px] font-bold text-slate-500">{dateHint}</span>
        ) : weekdayLabel ? (
          <span className="text-[11px] font-bold text-slate-500">
            Solo fechas de {weekdayLabel}.
          </span>
        ) : null}
      </div>
    </div>
  );

  const timeField = (
    <div className="grid gap-1">
      <span className="text-[10px] font-black uppercase text-slate-500">Hora</span>
      <TimePickerInput
        value={draft.time}
        onChange={(time) => setDraft((current) => ({ ...current, time }))}
        ariaLabel="Hora confirmada"
      />
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
              {dateField}
              {timeField}
            </>
          ) : (
            <>
              {dateField}
              {routeField}
              {showTimeField ? timeField : null}
            </>
          )}

          {showDriverPicker ? (
            <label className="grid gap-1">
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-slate-500">
                <Truck className="h-3.5 w-3.5" /> Conductor
              </span>
              <InlineSearchPicker
                value={driverId}
                onChange={setDriverId}
                options={driverOptions}
                placeholder="Sin conductor todavía"
                searchPlaceholder="Buscar conductor..."
                emptyLabel="Sin conductores"
                ariaLabel="Conductor confirmado"
              />
              {defaultDriverByWeekday[weekday] ? (
                <span className="text-[11px] font-bold text-slate-500">
                  Se seleccionó el conductor predeterminado de este día; puedes cambiarlo o dejarlo vacío.
                </span>
              ) : (
                <span className="text-[11px] font-bold text-slate-500">
                  Opcional. Puedes asignar el conductor después filtrando por ruta.
                </span>
              )}
            </label>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3">
          {allowPendingRoute && onConfirmPendingRoute ? (
            <button
              type="button"
              disabled={saving || ensuringDayRoute || !canLeavePendingRoute}
              onClick={() => void onConfirmPendingRoute({ routeDate: draft.date })}
              className={`${secondaryButtonClass} h-11 w-full text-sm font-black disabled:opacity-40`}
            >
              {pendingRouteLabel}
            </button>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving || ensuringDayRoute}
              className={`${secondaryButtonClass} h-11 text-sm font-black disabled:opacity-40`}
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving || ensuringDayRoute || !canConfirm}
              onClick={() => {
                if (!scheduledTimestamp || !routeTemplateId) {
                  return;
                }
                void (async () => {
                  let resolvedTemplateId = routeTemplateId;
                  if (isDayAsRouteTemplateId(resolvedTemplateId)) {
                    setEnsuringDayRoute(true);
                    const ensured = await ensureLogisticsDayRouteTemplateAction({
                      weekday: getLogisticsWeekdayIndex(draft.date),
                    });
                    setEnsuringDayRoute(false);
                    if (!ensured.ok) {
                      notify.error(ensured.error);
                      return;
                    }
                    resolvedTemplateId = ensured.data.id;
                  }
                  await onConfirm({
                    scheduledAt: scheduledTimestamp,
                    driverId: resolvedDriverId,
                    routeTemplateId: resolvedTemplateId,
                  });
                })();
              }}
              className={`${primaryButtonClass} h-11 text-sm font-black disabled:opacity-40`}
            >
              {saving || ensuringDayRoute ? "Confirmando..." : confirmLabel}
            </button>
          </div>
          {allowPendingRoute ? (
            <p className="text-center text-[11px] font-bold text-slate-500">
              Ruta pendiente conserva el día; Logística define la ruta y la hora.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
