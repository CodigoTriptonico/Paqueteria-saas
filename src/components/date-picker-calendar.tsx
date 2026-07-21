"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  buildVisibleCalendarMonth,
  formatCalendarMonthLabel,
  getWeekdayLabels,
  isDateDisabled,
  shiftCalendarMonth,
} from "@/lib/date-picker";
import {
  logisticsCalendarDayToneClass,
  logisticsCalendarDayToneDotClass,
  logisticsCalendarDayToneLegend,
  type LogisticsCalendarDayTone,
} from "@/lib/logistics-calendar-day-tones";
import { formatScheduleDateInput } from "@/lib/schedule-date";

const dayButtonClass =
  "relative flex h-9 items-center justify-center rounded-md text-sm font-black transition";

type DatePickerCalendarProps = {
  value: string;
  viewYear: number;
  viewMonth: number;
  min?: string;
  max?: string;
  allowedWeekdays?: number[];
  /** Optional logistics markers: YYYY-MM-DD → tone. */
  dayTones?: Readonly<Record<string, LogisticsCalendarDayTone>>;
  showToneLegend?: boolean;
  onChange: (value: string) => void;
  onViewChange: (year: number, month: number) => void;
};

export function DatePickerCalendar({
  value,
  viewYear,
  viewMonth,
  min,
  max,
  allowedWeekdays,
  dayTones,
  showToneLegend = false,
  onChange,
  onViewChange,
}: DatePickerCalendarProps) {
  const [today, setToday] = useState<string | null>(null);
  const weekdays = getWeekdayLabels();
  const days = useMemo(
    () => buildVisibleCalendarMonth(viewYear, viewMonth),
    [viewMonth, viewYear],
  );
  const hasTones = Boolean(dayTones && Object.keys(dayTones).length);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setToday(formatScheduleDateInput(new Date()));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      data-date-picker-panel
      className="w-full max-w-[17.5rem] overflow-hidden rounded-lg border border-black bg-surface-card shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2 border-b border-black bg-[#1a221f] px-2 py-2">
        <button
          type="button"
          onClick={() => {
            const next = shiftCalendarMonth(viewYear, viewMonth, -1);
            onViewChange(next.year, next.month);
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-black bg-surface-panel text-[#f8fafc] transition hover:bg-surface-card-hover"
          aria-label="Mes anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="min-w-0 flex-1 truncate text-center text-sm font-black capitalize text-[#f8fafc]">
          {formatCalendarMonthLabel(viewYear, viewMonth)}
        </p>
        <button
          type="button"
          onClick={() => {
            const next = shiftCalendarMonth(viewYear, viewMonth, 1);
            onViewChange(next.year, next.month);
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-black bg-surface-panel text-[#f8fafc] transition hover:bg-surface-card-hover"
          aria-label="Mes siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 px-2 pt-2">
        {weekdays.map((weekday) => (
          <span
            key={weekday}
            className="flex h-7 items-center justify-center text-[10px] font-black uppercase text-slate-500"
          >
            {weekday}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 p-2">
        {days.map((cell) => {
          if (!cell.inMonth) {
            return <span key={cell.date} className="h-9" aria-hidden />;
          }

          const selected = cell.date === value;
          const disabled = isDateDisabled(cell.date, min, max, { allowedWeekdays });
          const isToday = cell.date === today;
          const tone = dayTones?.[cell.date] || null;

          let stateClass: string;
          if (disabled) {
            stateClass = "cursor-not-allowed bg-surface-panel text-slate-600 opacity-40";
          } else if (tone) {
            stateClass = logisticsCalendarDayToneClass(tone);
          } else if (isToday) {
            stateClass =
              "border border-emerald-600/60 bg-surface-panel text-[#f8fafc] hover:bg-surface-card-hover";
          } else {
            stateClass = "bg-surface-panel text-[#f8fafc] hover:bg-surface-card-hover";
          }

          if (selected && !disabled) {
            // Selection is a ring only — never a fill — so the status palette stays readable.
            stateClass = `${stateClass} z-[1] ring-2 ring-white ring-offset-2 ring-offset-[#121816]`;
          }

          return (
            <button
              key={cell.date}
              type="button"
              disabled={disabled}
              onClick={() => onChange(cell.date)}
              className={`${dayButtonClass} ${stateClass}`}
              aria-label={tone ? `${cell.date} · ${tone}` : cell.date}
              aria-pressed={selected}
              data-day-tone={tone || undefined}
              data-day-selected={selected || undefined}
            >
              {cell.day}
              {tone && !disabled ? (
                <span
                  className={`absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${logisticsCalendarDayToneDotClass(tone)}`}
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {showToneLegend && hasTones ? (
        <div className="grid grid-cols-2 gap-1.5 border-t border-black px-2 py-2">
          {logisticsCalendarDayToneLegend.map((entry) => (
            <span
              key={entry.tone}
              className="inline-flex items-center gap-1.5 text-[10px] font-black text-slate-400"
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${logisticsCalendarDayToneDotClass(entry.tone)}`}
                aria-hidden
              />
              {entry.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
