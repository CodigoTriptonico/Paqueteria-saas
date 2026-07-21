"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { CircleAlert, Loader2, Route } from "lucide-react";
import {
  listPendingCustomerRouteAssignmentRequestsAction,
  replaceCustomerRouteAssignmentRequestAction,
  reviewCustomerRouteAssignmentRequestAction,
  type CustomerRouteAssignmentRequestRow,
} from "@/app/actions/customer-route-assignments";
import {
  ensureLogisticsDayRouteTemplateAction,
  type LogisticsRouteTemplateRow,
} from "@/app/actions/logistics-routes";
import type { RouteMemberRow } from "@/app/actions/shipments";
import { InlineSearchPicker } from "@/components/inline-search-picker";
import { LogisticsWeekdayPicker } from "@/components/logistica/logistics-weekday-picker";
import { ShipmentBoxLinesTrigger } from "@/components/shipment-box-lines-trigger";
import { TimePickerInput } from "@/components/time-picker-input";
import { usePageViewLayout } from "@/components/ui/ui-surface-preferences-provider";
import { Panel, primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import { useAnchoredPopover } from "@/hooks/use-anchored-popover";
import { useNotify } from "@/hooks/use-notify";
import {
  logisticsWeekdayKeys,
  type LogisticsWeekdayKey,
} from "@/lib/logistics-route-catalog";
import {
  dayAsRouteHint,
  enabledWeekdayIndexes,
  isDayAsRouteTemplateId,
  nextWeekdayScheduleHint,
  resolveDayRouteTemplateId,
  selectWeekdayDate,
} from "@/lib/logistics-day-route";
import {
  canSubmitCustomerRouteReplacement,
  draftFromScheduledAt,
  nextDateForTemplateWeekday,
} from "@/lib/customer-route-replacement";
import {
  getLogisticsWeekdayIndex,
  nextDateForAvailableWeekdays,
} from "@/lib/logistics-route-week";
import { minScheduleDateInput } from "@/lib/schedule-date";
import { scheduleAtToTimestamp, formatScheduleAtDisplay } from "@/lib/sale/schedule-time";

const taskTypeLabel: Record<string, string> = {
  deliver_empty_box: "Dejar caja vacía",
  pickup_full_box: "Recoger caja llena",
};

const APPROVAL_CARD_GRID_CLASS =
  "grid auto-rows-max gap-3 xl:grid-cols-2 2xl:grid-cols-3";

const HELP_PANEL_WIDTH = 320;

const APPROVAL_HELP_TEXT =
  "Se aprueba o se corrige la ruta, no el envío. Si la propuesta no sirve, cámbiala aquí: el invoice sigue y entra con la ruta que elijas. Si apruebas, las siguientes del mismo remitente en esa ruta entran solas.";

function RouteApprovalHelpButton() {
  const { open, setOpen, position, buttonRef, panelRef } = useAnchoredPopover(HELP_PANEL_WIDTH);

  const panel =
    open && position
      ? createPortal(
          <div
            ref={panelRef}
            className="fixed z-[180] overflow-hidden rounded-xl border border-black bg-surface-panel p-3 shadow-2xl"
            style={{ top: position.top, left: position.left, width: HELP_PANEL_WIDTH }}
            role="dialog"
            aria-label="Ayuda de rutas propuestas"
          >
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Cómo funciona</p>
            <p className="mt-2 text-sm font-bold leading-relaxed text-slate-300">{APPROVAL_HELP_TEXT}</p>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-black bg-surface-inset text-amber-200 transition hover:bg-surface-card-hover hover:text-amber-100"
        aria-label="Ver ayuda de rutas propuestas"
        aria-expanded={open}
        title="Cómo funciona"
        onClick={() => setOpen((current) => !current)}
      >
        <CircleAlert className="h-4 w-4" aria-hidden />
      </button>
      {panel}
    </>
  );
}

type ReplaceDraft = {
  routeTemplateId: string;
  date: string;
  time: string;
  driverId: string;
};

function emptyReplaceDraft(request: CustomerRouteAssignmentRequestRow): ReplaceDraft {
  const draft = draftFromScheduledAt(request.scheduledAt);
  return {
    routeTemplateId: "",
    date: draft.date,
    time: draft.time,
    driverId: "",
  };
}

export function CustomerRouteApprovalPanel({
  templates,
  enabledDays = [],
  defaultDriverByWeekday,
  routeMembers,
}: {
  templates: LogisticsRouteTemplateRow[];
  enabledDays?: LogisticsWeekdayKey[];
  defaultDriverByWeekday: Array<string | null>;
  routeMembers: RouteMemberRow[];
}) {
  const notify = useNotify();
  const { layout: viewLayout } = usePageViewLayout("logistics.tasks");
  const [requests, setRequests] = useState<CustomerRouteAssignmentRequestRow[]>([]);
  const [pending, startTransition] = useTransition();
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [replaceDraft, setReplaceDraft] = useState<ReplaceDraft | null>(null);

  const reload = useCallback(async () => {
    const result = await listPendingCustomerRouteAssignmentRequestsAction();
    if (result.ok) {
      setRequests(result.data);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  const availableWeekdays = useMemo(() => enabledWeekdayIndexes(enabledDays), [enabledDays]);

  const replaceWeekday = replaceDraft ? getLogisticsWeekdayIndex(replaceDraft.date) : -1;
  const replaceDateHint =
    replaceDraft && replaceWeekday >= 0 ? nextWeekdayScheduleHint(replaceDraft.date) : "";

  const dayTemplates = useMemo(
    () =>
      replaceDraft
        ? templates.filter((template) => Number(template.weekday) === replaceWeekday)
        : [],
    [replaceDraft, replaceWeekday, templates],
  );

  const dayAsRoute = Boolean(replaceDraft && dayTemplates.length === 0 && replaceWeekday >= 0);

  const dayTemplateOptions = useMemo(
    () =>
      dayTemplates.map((template) => ({
        value: template.id,
        label: template.name,
        searchText: `${logisticsWeekdayKeys[Number(template.weekday)] || ""} ${template.name}`,
      })),
    [dayTemplates],
  );

  const driverOptions = useMemo(
    () => [
      { value: "", label: "Sin conductor todavía", searchText: "sin conductor" },
      ...routeMembers
        .filter((member) => member.roleSlug === "conductor")
        .map((member) => ({
          value: member.id,
          label: member.label,
          searchText: member.label,
        })),
    ],
    [routeMembers],
  );

  const selectedReplaceTemplate = useMemo(
    () => templates.find((template) => template.id === replaceDraft?.routeTemplateId) || null,
    [replaceDraft?.routeTemplateId, templates],
  );

  const canSubmitReplace = Boolean(
    replaceDraft &&
      canSubmitCustomerRouteReplacement({
        routeTemplateId: replaceDraft.routeTemplateId,
        date: replaceDraft.date,
        time: replaceDraft.time,
        driverId: replaceDraft.driverId,
        dayAsRoute,
        templateWeekday: dayAsRoute
          ? replaceWeekday
          : selectedReplaceTemplate
            ? Number(selectedReplaceTemplate.weekday)
            : null,
      }),
  );

  const canOpenReplace = availableWeekdays.length > 0;

  function approveRoute(request: CustomerRouteAssignmentRequestRow) {
    startTransition(async () => {
      const result = await reviewCustomerRouteAssignmentRequestAction({
        requestId: request.id,
        decision: "approved",
      });
      if (!result.ok) {
        notify.error(result.error);
        return;
      }
      notify.success(`Ruta aprobada: ${request.customerName} en ${request.routeTemplateName}`);
      setReplacingId(null);
      setReplaceDraft(null);
      await reload();
    });
  }

  function openReplace(request: CustomerRouteAssignmentRequestRow) {
    const draft = emptyReplaceDraft(request);
    const startDate = nextDateForAvailableWeekdays(
      availableWeekdays,
      draft.date || minScheduleDateInput(),
    );
    const weekday = getLogisticsWeekdayIndex(startDate);

    draft.date = startDate;
    draft.routeTemplateId = resolveDayRouteTemplateId({
      weekday,
      templates,
      preferNotId: request.routeTemplateId,
    });
    draft.driverId = defaultDriverByWeekday[weekday] || "";
    setReplacingId(request.id);
    setReplaceDraft(draft);
  }

  function selectReplaceWeekday(weekday: number) {
    const date = selectWeekdayDate(weekday, minScheduleDateInput());
    setReplaceDraft((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        date,
        routeTemplateId: resolveDayRouteTemplateId({
          weekday,
          templates,
          currentTemplateId: current.routeTemplateId,
        }),
        driverId: defaultDriverByWeekday[weekday] || current.driverId || "",
      };
    });
  }

  function selectReplaceTemplate(nextTemplateId: string) {
    const template = templates.find((entry) => entry.id === nextTemplateId);
    if (!template || !replaceDraft) {
      setReplaceDraft((current) =>
        current ? { ...current, routeTemplateId: nextTemplateId } : current,
      );
      return;
    }

    const weekday = Number(template.weekday);
    const nextDate = dateMatchesWeekday(replaceDraft.date, weekday)
      ? replaceDraft.date
      : nextDateForTemplateWeekday(weekday, replaceDraft.date);

    setReplaceDraft({
      ...replaceDraft,
      routeTemplateId: nextTemplateId,
      date: nextDate,
      driverId: defaultDriverByWeekday[weekday] || replaceDraft.driverId || "",
    });
  }

  function dateMatchesWeekday(date: string, weekday: number) {
    return getLogisticsWeekdayIndex(date) === weekday;
  }

  function submitReplace(request: CustomerRouteAssignmentRequestRow) {
    if (!replaceDraft || !canSubmitReplace) {
      return;
    }

    const scheduledAt = scheduleAtToTimestamp(`${replaceDraft.date}T${replaceDraft.time}`);
    if (!scheduledAt) {
      notify.error("Fecha u hora inválida");
      return;
    }

    startTransition(async () => {
      let routeTemplateId = replaceDraft.routeTemplateId;
      let templateName =
        templates.find((template) => template.id === routeTemplateId)?.name || "ruta";

      if (isDayAsRouteTemplateId(routeTemplateId)) {
        const ensured = await ensureLogisticsDayRouteTemplateAction({
          weekday: getLogisticsWeekdayIndex(replaceDraft.date),
        });
        if (!ensured.ok) {
          notify.error(ensured.error);
          return;
        }
        routeTemplateId = ensured.data.id;
        templateName = ensured.data.name;
      }

      const result = await replaceCustomerRouteAssignmentRequestAction({
        requestId: request.id,
        routeTemplateId,
        scheduledAt,
        driverId: replaceDraft.driverId,
      });
      if (!result.ok) {
        notify.error(result.error);
        return;
      }
      notify.success(`Ruta cambiada: ${request.customerName} → ${templateName}`);
      setReplacingId(null);
      setReplaceDraft(null);
      await reload();
    });
  }

  function renderReplaceForm(request: CustomerRouteAssignmentRequestRow) {
    if (!replaceDraft || replacingId !== request.id) {
      return null;
    }

    return (
      <div className="mt-3 grid max-w-xl gap-3 rounded-lg border border-black bg-surface-panel p-3">
        <p className="text-xs font-black uppercase text-amber-200">Elegir ruta de reemplazo</p>
        <div className="grid gap-1">
          <span className="text-[10px] font-black uppercase text-slate-500">Día</span>
          <LogisticsWeekdayPicker
            value={replaceWeekday}
            availableWeekdays={availableWeekdays}
            disabled={availableWeekdays.length === 0}
            onChange={selectReplaceWeekday}
            ariaLabel="Día de la ruta de reemplazo"
          />
          {availableWeekdays.length === 0 ? (
            <span className="text-[11px] font-bold text-amber-200">
              No hay días disponibles en el calendario de rutas.
            </span>
          ) : replaceDateHint ? (
            <span className="text-[11px] font-bold text-slate-500">{replaceDateHint}</span>
          ) : null}
        </div>
        <div className="grid gap-1">
          <span className="text-[10px] font-black uppercase text-slate-500">
            Ruta del día
            {logisticsWeekdayKeys[replaceWeekday]
              ? ` · ${logisticsWeekdayKeys[replaceWeekday]}`
              : ""}
          </span>
          {dayAsRoute ? (
            <div className="rounded-lg border border-black bg-surface-inset px-3 py-2">
              <p className="text-sm font-black text-[#f8fafc]">
                {logisticsWeekdayKeys[replaceWeekday] || "Día"}
              </p>
              <p className="mt-0.5 text-[11px] font-bold text-slate-500">
                {dayAsRouteHint(replaceWeekday)}
              </p>
            </div>
          ) : (
            <InlineSearchPicker
              value={replaceDraft.routeTemplateId}
              onChange={selectReplaceTemplate}
              options={dayTemplateOptions}
              placeholder={
                dayTemplates.length
                  ? `Rutas de ${logisticsWeekdayKeys[replaceWeekday] || "ese día"}`
                  : "No hay rutas ese día"
              }
              searchPlaceholder="Buscar ruta..."
              emptyLabel={`No hay rutas para ${logisticsWeekdayKeys[replaceWeekday] || "ese día"}`}
              ariaLabel="Ruta de reemplazo"
              className="w-full min-w-0"
              minWidthClass="min-w-0 w-full"
            />
          )}
        </div>
        <div className="grid gap-1">
          <span className="text-[10px] font-black uppercase text-slate-500">Hora</span>
          <TimePickerInput
            value={replaceDraft.time}
            onChange={(time) =>
              setReplaceDraft((current) => (current ? { ...current, time } : current))
            }
            ariaLabel="Hora de la ruta de reemplazo"
          />
        </div>
        <div className="grid gap-1">
          <span className="text-[10px] font-black uppercase text-slate-500">Conductor</span>
          <InlineSearchPicker
            value={replaceDraft.driverId}
            onChange={(driverId) =>
              setReplaceDraft((current) => (current ? { ...current, driverId } : current))
            }
            options={driverOptions}
            placeholder="Sin conductor todavía"
            searchPlaceholder="Buscar conductor..."
            emptyLabel="Sin conductores"
            ariaLabel="Conductor de la ruta de reemplazo"
            className="w-full min-w-0"
            minWidthClass="min-w-0 w-full"
          />
          <span className="text-[11px] font-bold text-slate-500">
            Opcional. Puedes asignar el conductor después filtrando por ruta.
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={primaryButtonClass}
            disabled={pending || !canSubmitReplace}
            onClick={() => submitReplace(request)}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Asignar esta ruta
          </button>
          <button
            type="button"
            className={secondaryButtonClass}
            disabled={pending}
            onClick={() => {
              setReplacingId(null);
              setReplaceDraft(null);
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  function renderRequestDetails(request: CustomerRouteAssignmentRequestRow, mode: "rows" | "cards") {
    const weekdayLabel = logisticsWeekdayKeys[request.routeWeekday] || "";
    const taskLabel = taskTypeLabel[request.taskType] || request.taskType;

    if (mode === "rows") {
      return (
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-black text-[#f8fafc]">{request.customerName}</span>
            <span className="text-sm font-black text-emerald-300">{request.shipmentCode}</span>
            {request.customerPhone ? (
              <span className="text-xs font-bold text-slate-400">{request.customerPhone}</span>
            ) : null}
            <span className="inline-flex items-center rounded-md border border-black/70 bg-surface-inset px-1.5 py-0.5 text-[10px] font-black uppercase text-slate-300">
              {taskLabel}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-700/50 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-black text-amber-100">
              {request.routeTemplateName}
              {weekdayLabel ? <span className="text-amber-200/80">· {weekdayLabel}</span> : null}
            </span>
            <span className="text-[11px] font-bold text-slate-400">
              {formatScheduleAtDisplay(request.scheduledAt)}
            </span>
          </div>
          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold leading-snug text-slate-400">
            <span
              className={`line-clamp-2 min-w-0 flex-1 text-sm font-black leading-snug ${
                request.formattedAddress === "Sin dirección" ? "text-amber-200" : "text-[#f8fafc]"
              }`}
              title={request.formattedAddress}
            >
              {request.formattedAddress}
              {request.addressReference ? ` · Ref: ${request.addressReference}` : ""}
            </span>
            {request.boxLines.length ? (
              <ShipmentBoxLinesTrigger lines={request.boxLines} variant="inline" />
            ) : (
              <span className="shrink-0 text-slate-500">{request.boxSummary}</span>
            )}
            <span className="shrink-0 text-slate-500">Zona {request.zoneKey}</span>
            <span className="shrink-0 text-slate-500">{request.driverLabel}</span>
          </div>
        </div>
      );
    }

    return (
      <div className="min-w-0 grid gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="text-lg font-black text-[#f8fafc]">{request.customerName}</p>
            <span className="text-sm font-black text-emerald-300">{request.shipmentCode}</span>
          </div>
          {request.customerPhone ? (
            <p className="mt-0.5 text-sm font-bold text-slate-300">{request.customerPhone}</p>
          ) : null}
        </div>

        <div
          className={`rounded-md border px-3 py-2 ${
            request.formattedAddress === "Sin dirección"
              ? "border-amber-700 bg-amber-400/15"
              : "border-black bg-surface-inset"
          }`}
        >
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Dirección</p>
          <p
            className={`mt-1 text-base font-black leading-snug sm:text-lg ${
              request.formattedAddress === "Sin dirección" ? "text-amber-100" : "text-[#f8fafc]"
            }`}
          >
            {request.formattedAddress}
          </p>
          {request.addressReference ? (
            <p className="mt-1 text-xs font-bold text-slate-400">Ref: {request.addressReference}</p>
          ) : null}
          <p className="mt-1 text-xs font-bold text-slate-400">Zona {request.zoneKey}</p>
        </div>

        <div className="grid gap-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Cajas</p>
            {request.boxLines.length ? (
              <div className="mt-1">
                <ShipmentBoxLinesTrigger lines={request.boxLines} variant="card" />
              </div>
            ) : (
              <p className="mt-1 text-sm font-black text-slate-300">{request.boxSummary}</p>
            )}
          </div>

          <div className="rounded-md border border-black bg-surface-inset px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-wide text-amber-200">
              Ruta propuesta
            </p>
            <p className="mt-1 text-base font-black text-[#f8fafc]">
              {request.routeTemplateName}
              {weekdayLabel ? (
                <span className="ml-2 text-sm font-bold text-slate-400">{weekdayLabel}</span>
              ) : null}
            </p>
            <p className="mt-1 text-sm font-bold text-slate-300">
              {taskLabel} · {formatScheduleAtDisplay(request.scheduledAt)}
            </p>
            <p className="mt-0.5 text-xs font-bold text-slate-400">{request.driverLabel}</p>
          </div>
        </div>
      </div>
    );
  }

  function renderRequest(request: CustomerRouteAssignmentRequestRow, mode: "rows" | "cards") {
    const isReplacing = replacingId === request.id;

    if (mode === "cards") {
      return (
        <article
          key={request.id}
          className="flex h-full flex-col gap-3 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3"
        >
          {renderRequestDetails(request, "cards")}
          {renderReplaceForm(request)}
          {!isReplacing ? (
            <div className="mt-auto flex flex-wrap gap-2">
              <button
                type="button"
                className={primaryButtonClass}
                disabled={pending}
                onClick={() => approveRoute(request)}
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Aprobar ruta
              </button>
              <button
                type="button"
                className={secondaryButtonClass}
                disabled={pending || !canOpenReplace}
                onClick={() => openReplace(request)}
              >
                Cambiar ruta
              </button>
            </div>
          ) : null}
        </article>
      );
    }

    return (
      <article
        key={request.id}
        className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2.5"
      >
        <div className="flex w-full min-w-0 flex-col gap-2 lg:flex-row lg:items-center lg:gap-4">
          {renderRequestDetails(request, "rows")}
          {!isReplacing ? (
            <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
              <button
                type="button"
                className={primaryButtonClass}
                disabled={pending}
                onClick={() => approveRoute(request)}
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Aprobar ruta
              </button>
              <button
                type="button"
                className={secondaryButtonClass}
                disabled={pending || !canOpenReplace}
                onClick={() => openReplace(request)}
              >
                Cambiar ruta
              </button>
            </div>
          ) : null}
        </div>
        {renderReplaceForm(request)}
      </article>
    );
  }

  return (
    <Panel
      title="Rutas propuestas por vendedores"
      action={
        <span className="inline-flex items-center gap-2">
          <RouteApprovalHelpButton />
          <Route className="h-5 w-5 text-amber-300" aria-hidden />
        </span>
      }
    >
      {requests.length ? (
        viewLayout === "rows" ? (
          <div className="grid gap-2">{requests.map((request) => renderRequest(request, "rows"))}</div>
        ) : (
          <div className={APPROVAL_CARD_GRID_CLASS}>
            {requests.map((request) => renderRequest(request, "cards"))}
          </div>
        )
      ) : (
        <div className="rounded-lg border border-dashed border-slate-700 px-4 py-8 text-center text-sm font-bold text-slate-400">
          No hay rutas pendientes de aprobación.
        </div>
      )}
    </Panel>
  );
}
