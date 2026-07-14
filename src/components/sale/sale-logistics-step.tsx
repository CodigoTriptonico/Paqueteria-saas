"use client";

import {
  Building2,
  Truck,
} from "lucide-react";
import {
  deliveryModeCardClass,
  deliveryModeIconClass,
  deliverySegmentClass,
  deliverySummary,
  EMPTY_BOX_DRIVER_MODE,
  EMPTY_BOX_OFFICE_MODE,
  FULL_BOX_DEFERRED_SUMMARY,
  FULL_BOX_DRIVER_MODE,
  FULL_BOX_OFFICE_MODE,
  fullBoxSummaryLine,
  logisticsLegComplete,
  minScheduleDateInput,
  resolveScheduleDate,
} from "@/components/sale/venta-parts";
import { DateInput } from "@/components/date-input";
import { ScheduleTimeField } from "@/components/sale/schedule-time-field";

type ScheduleMode = "pending" | "scheduled";

type SaleLogisticsStepProps = {
  emptyBoxMode: string;
  emptyBoxScheduleMode: string;
  emptyBoxScheduleAt: string;
  fullBoxMode: string;
  fullBoxScheduleMode: string;
  fullBoxScheduleAt: string;
  emptyBoxRouteDate: string;
  emptyBoxRouteTime: string;
  fullBoxRouteDate: string;
  fullBoxRouteTime: string;
  onSelectEmptyBoxMode: (mode: string) => void;
  onSelectEmptyBoxScheduleMode: (mode: ScheduleMode) => void;
  onUpdateEmptyBoxSchedule: (date?: string, time?: string) => void;
  onQuickEmptyBoxDate: (daysFromToday: number) => void;
  onSelectFullBoxMode: (mode: string) => void;
  onSelectFullBoxScheduleMode: (mode: ScheduleMode) => void;
  onUpdateFullBoxSchedule: (date?: string, time?: string) => void;
  onQuickFullBoxDate: (daysFromToday: number) => void;
  fullBoxPickupExpanded: boolean;
  onExpandFullBoxPickup: () => void;
  onDeferFullBoxPickup: () => void;
};

function SchedulePanel({
  scheduleMode,
  routeDate,
  routeTime,
  onSelectScheduleMode,
  onUpdateSchedule,
  onQuickDate,
}: {
  scheduleMode: string;
  routeDate: string;
  routeTime: string;
  onSelectScheduleMode: (mode: ScheduleMode) => void;
  onUpdateSchedule: (date?: string, time?: string) => void;
  onQuickDate: (daysFromToday: number) => void;
}) {
  return (
    <div className="rounded-xl border border-black/80 bg-[#2e3834] p-3">
      <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-slate-500">
        Cuándo va el chofer
      </p>

      <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-panel p-1">
        <button
          type="button"
          onClick={() => onSelectScheduleMode("pending")}
          className={`h-9 rounded-md text-xs font-black transition ${deliverySegmentClass(
            scheduleMode === "pending",
          )}`}
        >
          Sin fecha aún
        </button>
        <button
          type="button"
          onClick={() => onSelectScheduleMode("scheduled")}
          className={`h-9 rounded-md text-xs font-black transition ${deliverySegmentClass(
            scheduleMode === "scheduled",
          )}`}
        >
          Con fecha y hora
        </button>
      </div>

      {scheduleMode === "pending" ? (
        <p className="mt-2.5 text-sm font-bold leading-snug text-slate-400">
          Queda en cola. El despacho asigna ruta después.
        </p>
      ) : null}

      {scheduleMode === "scheduled" ? (
        <div className="mt-3 grid gap-3 border-t border-black/70 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-black text-slate-400">Atajos de fecha</p>
            <div className="flex gap-1.5">
              {[
                ["Hoy", 0],
                ["Mañana", 1],
              ].map(([label, days]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => onQuickDate(Number(days))}
                  className="h-8 rounded-md border border-black bg-surface-inset px-3 text-xs font-black text-[#f8fafc] hover:bg-surface-card-hover"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <label className="grid gap-1.5">
            <span className="text-[11px] font-black uppercase text-slate-500">Fecha</span>
            <DateInput
              compact={false}
              min={minScheduleDateInput()}
              value={routeDate}
              ariaLabel="Fecha de entrega"
              onChange={(nextValue) =>
                onUpdateSchedule(resolveScheduleDate(nextValue), routeTime)
              }
            />
          </label>

          <ScheduleTimeField
            value={routeTime}
            onChange={(timePart) => onUpdateSchedule(routeDate, timePart)}
          />
        </div>
      ) : null}
    </div>
  );
}

function StepBadge({
  step,
  complete,
}: {
  step: 1 | 2;
  complete: boolean;
}) {
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-black shadow-[0_4px_14px_rgba(0,0,0,0.25)] sm:h-9 sm:w-9 sm:text-sm ${
        complete
          ? "border-emerald-600 bg-emerald-400 text-slate-950"
          : "border-black bg-[#3a4842] text-emerald-300"
      }`}
    >
      {step}
    </span>
  );
}

function MovementCard({
  step,
  title,
  hint,
  summary,
  complete,
  mode,
  officeMode,
  driverMode,
  officeLabel,
  driverLabel,
  officeDetail,
  driverDetail,
  scheduleMode,
  routeDate,
  routeTime,
  onSelectMode,
  onSelectScheduleMode,
  onUpdateSchedule,
  onQuickDate,
  showOfficeHandingOption = false,
}: {
  step: 1 | 2;
  title: string;
  hint: string;
  summary: string;
  complete: boolean;
  mode: string;
  officeMode: string;
  driverMode: string;
  officeLabel: string;
  driverLabel: string;
  officeDetail: string;
  driverDetail: string;
  scheduleMode: string;
  routeDate: string;
  routeTime: string;
  onSelectMode: (mode: string) => void;
  onSelectScheduleMode: (mode: ScheduleMode) => void;
  onUpdateSchedule: (date?: string, time?: string) => void;
  onQuickDate: (daysFromToday: number) => void;
  showOfficeHandingOption?: boolean;
}) {
  const officeSelected = mode === officeMode;
  const driverSelected = mode === driverMode;
  const hasSelection = Boolean(mode);
  const compactOfficeSelection = officeSelected && showOfficeHandingOption;

  return (
    <section
      className={`flex min-w-0 flex-col rounded-xl border-2 bg-[#3a4842] p-3 shadow-[0_6px_20px_rgba(0,0,0,0.18)] transition-colors sm:p-4 ${
        complete ? "border-emerald-700/50" : "border-black"
      }`}
    >
      <div className="mb-3 flex items-start gap-2.5 sm:mb-4 sm:gap-3">
        <StepBadge step={step} complete={complete} />
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
            {step === 1 ? "Primero" : "Después"}
          </p>
          <h3 className="mt-0.5 text-base font-black leading-snug text-[#f8fafc] sm:text-lg">{title}</h3>
          <p className="mt-1 text-xs font-bold leading-snug text-slate-400 sm:text-sm">{hint}</p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onSelectMode(officeMode)}
          className={`min-h-[4rem] rounded-xl border p-2.5 text-left transition sm:min-h-[4.75rem] sm:p-3 ${deliveryModeCardClass(
            officeSelected,
          )}`}
        >
          <span className="flex items-start gap-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${deliveryModeIconClass(
                officeSelected,
              )}`}
            >
              <Building2 className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span
                className={`block text-sm font-black ${officeSelected ? "text-emerald-50" : "text-[#f8fafc]"}`}
              >
                {officeLabel}
              </span>
              <span
                className={`mt-1 block text-xs font-bold leading-snug ${
                  officeSelected ? "text-emerald-100/80" : "text-slate-300"
                }`}
              >
                {officeDetail}
              </span>
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelectMode(driverMode)}
          className={`min-h-[4rem] rounded-xl border p-2.5 text-left transition sm:min-h-[4.75rem] sm:p-3 ${deliveryModeCardClass(
            driverSelected,
          )}`}
        >
          <span className="flex items-start gap-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${deliveryModeIconClass(
                driverSelected,
              )}`}
            >
              <Truck className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span
                className={`block text-sm font-black ${driverSelected ? "text-emerald-50" : "text-[#f8fafc]"}`}
              >
                {driverLabel}
              </span>
              <span
                className={`mt-1 block text-xs font-bold leading-snug ${
                  driverSelected ? "text-emerald-100/80" : "text-slate-300"
                }`}
              >
                {driverDetail}
              </span>
            </span>
          </span>
        </button>
      </div>

      {!hasSelection ? (
        <p className="mt-3 text-center text-xs font-bold text-slate-500 sm:text-sm">
          Elige una opción para continuar
        </p>
      ) : compactOfficeSelection ? null : officeSelected ? (
        <div className="mt-3">
          <p className="rounded-lg border border-black/70 bg-[#2e3834] px-3 py-2.5 text-sm font-bold text-slate-400">
            Sin ruta de chofer — el cliente se encarga en oficina.
          </p>
        </div>
      ) : driverSelected ? (
        <div className="mt-3">
          <SchedulePanel
            scheduleMode={scheduleMode}
            routeDate={routeDate}
            routeTime={routeTime}
            onSelectScheduleMode={onSelectScheduleMode}
            onUpdateSchedule={onUpdateSchedule}
            onQuickDate={onQuickDate}
          />
        </div>
      ) : null}

      {hasSelection && !compactOfficeSelection ? (
        <div className="mt-auto border-t border-black/70 pt-3">
          <p className="text-[11px] font-black uppercase text-slate-500">Quedó así</p>
          <p className="mt-1 text-sm font-black leading-snug text-emerald-100/90">{summary}</p>
        </div>
      ) : null}
    </section>
  );
}

export function SaleLogisticsStep({
  emptyBoxMode,
  emptyBoxScheduleMode,
  emptyBoxScheduleAt,
  fullBoxMode,
  fullBoxScheduleMode,
  fullBoxScheduleAt,
  emptyBoxRouteDate,
  emptyBoxRouteTime,
  fullBoxRouteDate,
  fullBoxRouteTime,
  onSelectEmptyBoxMode,
  onSelectEmptyBoxScheduleMode,
  onUpdateEmptyBoxSchedule,
  onQuickEmptyBoxDate,
  onSelectFullBoxMode,
  onSelectFullBoxScheduleMode,
  onUpdateFullBoxSchedule,
  onQuickFullBoxDate,
  fullBoxPickupExpanded,
  onExpandFullBoxPickup,
  onDeferFullBoxPickup,
}: SaleLogisticsStepProps) {
  const emptySummary = deliverySummary(
    emptyBoxMode,
    emptyBoxScheduleMode,
    emptyBoxScheduleAt,
  );
  const fullSummary = fullBoxSummaryLine(fullBoxMode, fullBoxScheduleMode, fullBoxScheduleAt);
  const emptyComplete = logisticsLegComplete(emptyBoxMode, emptyBoxScheduleMode, emptyBoxScheduleAt);
  const fullComplete = logisticsLegComplete(fullBoxMode, fullBoxScheduleMode, fullBoxScheduleAt);

  return (
    <div className="grid w-full gap-3 pb-2 sm:gap-4 sm:pb-4">
      <div className="mx-auto w-full max-w-2xl space-y-2.5 sm:space-y-3">
        <MovementCard
          step={1}
          title="Caja vacía sale de oficina"
          hint="¿Cómo sale la caja vacía?"
          summary={emptySummary}
          complete={emptyComplete}
          mode={emptyBoxMode}
          officeMode={EMPTY_BOX_OFFICE_MODE}
          driverMode={EMPTY_BOX_DRIVER_MODE}
          officeLabel="Entrega en oficina"
          driverLabel="Chofer entrega"
          officeDetail="Se entrega ahora en mostrador."
          driverDetail="La llevamos a su domicilio."
          scheduleMode={emptyBoxScheduleMode}
          routeDate={emptyBoxRouteDate}
          routeTime={emptyBoxRouteTime}
          onSelectMode={onSelectEmptyBoxMode}
          onSelectScheduleMode={onSelectEmptyBoxScheduleMode}
          onUpdateSchedule={onUpdateEmptyBoxSchedule}
          onQuickDate={onQuickEmptyBoxDate}
          showOfficeHandingOption
        />

        {emptyComplete && !fullBoxPickupExpanded ? (
          <p className="px-1 text-center text-xs leading-relaxed text-slate-500">
            <span className="font-bold text-slate-400">
              Caja llena: {FULL_BOX_DEFERRED_SUMMARY}.
            </span>{" "}
            <button
              type="button"
              onClick={onExpandFullBoxPickup}
              title="Programar recolección ahora"
              className="font-black text-slate-400 underline-offset-2 hover:text-slate-300 hover:underline"
            >
              Programar ahora
            </button>
          </p>
        ) : null}

        {fullBoxPickupExpanded ? (
          <div className="space-y-2">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onDeferFullBoxPickup}
                className="text-[11px] font-black text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
              >
                Dejar pendiente
              </button>
            </div>
            <MovementCard
              step={2}
              title="Caja llena vuelve a oficina"
              hint="¿Cómo regresa con el envío?"
              summary={fullSummary}
              complete={fullComplete}
              mode={fullBoxMode}
              officeMode={FULL_BOX_OFFICE_MODE}
              driverMode={FULL_BOX_DRIVER_MODE}
              officeLabel="Cliente trae"
              driverLabel="Chofer recoge"
              officeDetail="La devuelve en la oficina."
              driverDetail="Pasamos a recogerla."
              scheduleMode={fullBoxScheduleMode}
              routeDate={fullBoxRouteDate}
              routeTime={fullBoxRouteTime}
              onSelectMode={onSelectFullBoxMode}
              onSelectScheduleMode={onSelectFullBoxScheduleMode}
              onUpdateSchedule={onUpdateFullBoxSchedule}
              onQuickDate={onQuickFullBoxDate}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
