"use client";

import {
  ArrowDown,
  Building2,
  CalendarDays,
  Check,
  Truck,
} from "lucide-react";
import type { RefObject } from "react";
import {
  deliveryModeCardClass,
  deliveryModeIconClass,
  deliverySegmentClass,
  deliverySummary,
  EMPTY_BOX_DRIVER_MODE,
  EMPTY_BOX_OFFICE_MODE,
  FULL_BOX_DRIVER_MODE,
  FULL_BOX_OFFICE_MODE,
  inputClass,
  logisticsLegComplete,
  minScheduleDateInput,
  resolveScheduleDate,
} from "@/components/sale/venta-parts";
import { ScheduleTimeField } from "@/components/sale/schedule-time-field";
import { primaryButtonClass } from "@/components/ui-blocks";

type ScheduleMode = "pending" | "scheduled";

type SaleLogisticsStepProps = {
  emptyBoxHandingNow: boolean;
  onEmptyBoxHandingNowChange: (value: boolean) => void;
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
  emptyDateInputRef: RefObject<HTMLInputElement | null>;
  fullDateInputRef: RefObject<HTMLInputElement | null>;
  onSelectEmptyBoxMode: (mode: string) => void;
  onSelectEmptyBoxScheduleMode: (mode: ScheduleMode) => void;
  onUpdateEmptyBoxSchedule: (date?: string, time?: string) => void;
  onQuickEmptyBoxDate: (daysFromToday: number) => void;
  onOpenEmptyBoxDatePicker: () => void;
  onSelectFullBoxMode: (mode: string) => void;
  onSelectFullBoxScheduleMode: (mode: ScheduleMode) => void;
  onUpdateFullBoxSchedule: (date?: string, time?: string) => void;
  onQuickFullBoxDate: (daysFromToday: number) => void;
  onOpenFullBoxDatePicker: () => void;
  canContinue: boolean;
  onContinue: () => void;
};

function SchedulePanel({
  scheduleMode,
  routeDate,
  routeTime,
  dateInputRef,
  onSelectScheduleMode,
  onUpdateSchedule,
  onQuickDate,
  onOpenDatePicker,
}: {
  scheduleMode: string;
  routeDate: string;
  routeTime: string;
  dateInputRef: RefObject<HTMLInputElement | null>;
  onSelectScheduleMode: (mode: ScheduleMode) => void;
  onUpdateSchedule: (date?: string, time?: string) => void;
  onQuickDate: (daysFromToday: number) => void;
  onOpenDatePicker: () => void;
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
            <span className="relative block">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={dateInputRef}
                className={`${inputClass} w-full pl-10`}
                type="date"
                min={minScheduleDateInput()}
                value={routeDate}
                onClick={onOpenDatePicker}
                onChange={(event) =>
                  onUpdateSchedule(resolveScheduleDate(event.target.value), routeTime)
                }
              />
            </span>
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

function OfficeHandingPanel({
  handingNow,
  onChange,
}: {
  handingNow: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="rounded-xl border border-black/70 bg-[#2e3834] p-3">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={handingNow}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-black bg-surface-inset accent-emerald-400"
        />
        <span className="min-w-0">
          <span className="block text-sm font-black text-[#f8fafc]">Se la entregamos ahora</span>
          <span className="mt-0.5 block text-xs font-bold leading-snug text-slate-400">
            {handingNow
              ? "La caja sale del mostrador en este momento."
              : "Queda pendiente — el cliente la recogerá después en oficina."}
          </span>
        </span>
      </label>
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
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-black shadow-[0_4px_14px_rgba(0,0,0,0.25)] ${
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
  dateInputRef,
  onSelectMode,
  onSelectScheduleMode,
  onUpdateSchedule,
  onQuickDate,
  onOpenDatePicker,
  officeHandingNow,
  onOfficeHandingNowChange,
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
  dateInputRef: RefObject<HTMLInputElement | null>;
  onSelectMode: (mode: string) => void;
  onSelectScheduleMode: (mode: ScheduleMode) => void;
  onUpdateSchedule: (date?: string, time?: string) => void;
  onQuickDate: (daysFromToday: number) => void;
  onOpenDatePicker: () => void;
  officeHandingNow?: boolean;
  onOfficeHandingNowChange?: (value: boolean) => void;
  showOfficeHandingOption?: boolean;
}) {
  const officeSelected = mode === officeMode;
  const driverSelected = mode === driverMode;
  const hasSelection = Boolean(mode);

  return (
    <section
      className={`flex h-full min-w-0 flex-col rounded-xl border-2 bg-[#3a4842] p-4 shadow-[0_6px_20px_rgba(0,0,0,0.18)] transition-colors ${
        complete ? "border-emerald-700/50" : "border-black"
      }`}
    >
      <div className="mb-4 flex items-start gap-3">
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
          className={`min-h-[5.25rem] rounded-xl border p-3 text-left transition ${deliveryModeCardClass(
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
          className={`min-h-[5.25rem] rounded-xl border p-3 text-left transition ${deliveryModeCardClass(
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
      ) : (
        <div className="mt-3">
          {officeSelected && showOfficeHandingOption ? (
            <OfficeHandingPanel
              handingNow={officeHandingNow ?? true}
              onChange={onOfficeHandingNowChange ?? (() => undefined)}
            />
          ) : officeSelected ? (
            <p className="rounded-lg border border-black/70 bg-[#2e3834] px-3 py-2.5 text-sm font-bold text-slate-400">
              Sin ruta de chofer — el cliente se encarga en oficina.
            </p>
          ) : driverSelected ? (
            <SchedulePanel
              scheduleMode={scheduleMode}
              routeDate={routeDate}
              routeTime={routeTime}
              dateInputRef={dateInputRef}
              onSelectScheduleMode={onSelectScheduleMode}
              onUpdateSchedule={onUpdateSchedule}
              onQuickDate={onQuickDate}
              onOpenDatePicker={onOpenDatePicker}
            />
          ) : null}
        </div>
      )}

      {hasSelection ? (
        <div className="mt-auto border-t border-black/70 pt-3">
          <p className="text-[11px] font-black uppercase text-slate-500">Quedó así</p>
          <p className="mt-1 text-sm font-black leading-snug text-emerald-100/90">{summary}</p>
        </div>
      ) : null}
    </section>
  );
}

export function SaleLogisticsStep({
  emptyBoxHandingNow,
  onEmptyBoxHandingNowChange,
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
  emptyDateInputRef,
  fullDateInputRef,
  onSelectEmptyBoxMode,
  onSelectEmptyBoxScheduleMode,
  onUpdateEmptyBoxSchedule,
  onQuickEmptyBoxDate,
  onOpenEmptyBoxDatePicker,
  onSelectFullBoxMode,
  onSelectFullBoxScheduleMode,
  onUpdateFullBoxSchedule,
  onQuickFullBoxDate,
  onOpenFullBoxDatePicker,
  canContinue,
  onContinue,
}: SaleLogisticsStepProps) {
  const emptySummary = deliverySummary(
    emptyBoxMode,
    emptyBoxScheduleMode,
    emptyBoxScheduleAt,
    emptyBoxHandingNow,
  );
  const fullSummary = deliverySummary(fullBoxMode, fullBoxScheduleMode, fullBoxScheduleAt);
  const emptyComplete = logisticsLegComplete(emptyBoxMode, emptyBoxScheduleMode, emptyBoxScheduleAt);
  const fullComplete = logisticsLegComplete(fullBoxMode, fullBoxScheduleMode, fullBoxScheduleAt);

  return (
    <div className="grid w-full gap-4">
      <div className="grid items-start gap-3 xl:grid-cols-2 xl:gap-4">
        <MovementCard
          step={1}
          title="Caja vacía sale de oficina"
          hint="¿Quién se la lleva al cliente?"
          summary={emptySummary}
          complete={emptyComplete}
          mode={emptyBoxMode}
          officeMode={EMPTY_BOX_OFFICE_MODE}
          driverMode={EMPTY_BOX_DRIVER_MODE}
          officeLabel="Cliente recoge"
          driverLabel="Chofer entrega"
          officeDetail="Pasa por la oficina y se la lleva."
          driverDetail="La llevamos a su domicilio."
          scheduleMode={emptyBoxScheduleMode}
          routeDate={emptyBoxRouteDate}
          routeTime={emptyBoxRouteTime}
          dateInputRef={emptyDateInputRef}
          onSelectMode={onSelectEmptyBoxMode}
          onSelectScheduleMode={onSelectEmptyBoxScheduleMode}
          onUpdateSchedule={onUpdateEmptyBoxSchedule}
          onQuickDate={onQuickEmptyBoxDate}
          onOpenDatePicker={onOpenEmptyBoxDatePicker}
          officeHandingNow={emptyBoxHandingNow}
          onOfficeHandingNowChange={onEmptyBoxHandingNowChange}
          showOfficeHandingOption
        />

        <div className="flex items-center justify-center py-0.5 xl:hidden" aria-hidden>
          <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-black bg-[#3a4842] text-emerald-300/70">
            <ArrowDown className="h-4 w-4" />
          </span>
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
          dateInputRef={fullDateInputRef}
          onSelectMode={onSelectFullBoxMode}
          onSelectScheduleMode={onSelectFullBoxScheduleMode}
          onUpdateSchedule={onUpdateFullBoxSchedule}
          onQuickDate={onQuickFullBoxDate}
          onOpenDatePicker={onOpenFullBoxDatePicker}
        />
      </div>

      <div className="flex justify-center border-t border-black/80 pt-4">
        <div className="flex w-full max-w-md flex-col items-center gap-2">
          <button
            type="button"
            disabled={!canContinue}
            onClick={onContinue}
            className={`${primaryButtonClass} flex h-12 w-full items-center justify-center gap-2 text-sm disabled:cursor-not-allowed disabled:opacity-35`}
          >
            <Check className="h-4 w-4" />
            Finalizar entrega
          </button>
          <p className="text-center text-xs font-bold text-slate-500">
            {canContinue
              ? "Listo — continúa a crear el invoice."
              : "Completa los dos movimientos para continuar."}
          </p>
        </div>
      </div>
    </div>
  );
}
