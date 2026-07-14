"use client";

import { ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";
import {
  from12HourParts,
  HOUR_OPTIONS,
  MINUTE_OPTIONS,
  type ParsedTimeInput,
  type TimePeriod,
} from "@/lib/time-picker";

const cellClass = "flex h-9 items-center justify-center rounded-md text-sm font-black transition";

type TimePickerStep = "hour" | "minute";

type TimePickerCalendarProps = {
  view: ParsedTimeInput;
  onChange: (value: string) => void;
  onComplete?: () => void;
};

export function TimePickerCalendar({ view, onChange, onComplete }: TimePickerCalendarProps) {
  const [step, setStep] = useState<TimePickerStep>("hour");
  const [draft, setDraft] = useState(view);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) setDraft(view);
    });
    return () => {
      active = false;
    };
  }, [view]);

  function pickPeriod(period: TimePeriod) {
    setDraft((current) => ({ ...current, period }));
  }

  function pickHour(hour12: number) {
    setDraft((current) => ({ ...current, hour12 }));
    setStep("minute");
  }

  function pickMinute(minute: number) {
    const value = from12HourParts(draft.hour12, minute, draft.period);
    onChange(value);
    onComplete?.();
  }

  return (
    <div
      data-time-picker-panel
      className="w-full max-w-[12.75rem] overflow-hidden rounded-lg border border-black bg-surface-card shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 border-b border-black bg-[#1a221f] p-2">
        <span
          className={`flex h-8 items-center justify-center rounded-md border text-sm font-black ${
            step === "hour"
              ? "border-emerald-600/70 bg-emerald-400/15 text-emerald-100"
              : "border-black bg-surface-panel text-[#f8fafc]"
          }`}
        >
          {String(draft.hour12).padStart(2, "0")}
        </span>
        <span className="text-sm font-black text-slate-500">:</span>
        <span
          className={`flex h-8 items-center justify-center rounded-md border text-sm font-black ${
            step === "minute"
              ? "border-emerald-600/70 bg-emerald-400/15 text-emerald-100"
              : "border-black bg-surface-panel text-slate-500"
          }`}
        >
          {step === "minute" ? String(draft.minute).padStart(2, "0") : "--"}
        </span>
        <span className="col-span-3 mt-1 flex h-7 items-center justify-center rounded-md border border-black bg-surface-panel text-xs font-black text-[#f8fafc]">
          {draft.period}
        </span>
      </div>

      {step === "hour" ? (
        <div className="p-2">
          <p className="mb-2 text-center text-[10px] font-black uppercase tracking-wide text-slate-500">
            Elige la hora
          </p>
          <div className="mb-2 grid grid-cols-2 gap-1">
            {(["AM", "PM"] as const).map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => pickPeriod(period)}
                className={`${cellClass} ${
                  period === draft.period
                    ? "bg-emerald-400 text-slate-950"
                    : "bg-surface-panel text-[#f8fafc] hover:bg-surface-card-hover"
                }`}
                aria-pressed={period === draft.period}
              >
                {period}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-1">
            {HOUR_OPTIONS.map((hour) => (
              <button
                key={hour}
                type="button"
                onClick={() => pickHour(hour)}
                className={`${cellClass} ${
                  hour === draft.hour12
                    ? "bg-emerald-400 text-slate-950"
                    : "bg-surface-panel text-[#f8fafc] hover:bg-surface-card-hover"
                }`}
                aria-pressed={hour === draft.hour12}
              >
                {String(hour).padStart(2, "0")}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setStep("hour")}
              className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[10px] font-black uppercase text-slate-400 transition hover:bg-surface-panel hover:text-[#f8fafc]"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Hora
            </button>
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
              Elige el minuto
            </p>
            <span className="w-10" aria-hidden />
          </div>
          <div className="grid max-h-36 grid-cols-4 gap-1 overflow-y-auto">
            {MINUTE_OPTIONS.map((minute) => (
              <button
                key={minute}
                type="button"
                onClick={() => pickMinute(minute)}
                className={`${cellClass} ${
                  minute === draft.minute
                    ? "bg-emerald-400 text-slate-950"
                    : "bg-surface-panel text-[#f8fafc] hover:bg-surface-card-hover"
                }`}
                aria-pressed={minute === draft.minute}
              >
                {String(minute).padStart(2, "0")}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
