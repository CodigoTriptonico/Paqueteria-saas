"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  buildCalendarMonth,
  formatCalendarMonthLabel,
  getWeekdayLabels,
  isDateDisabled,
  shiftCalendarMonth,
} from "@/lib/date-picker";
import { formatScheduleDateInput } from "@/lib/schedule-date";

const dayButtonClass =
  "flex h-9 items-center justify-center rounded-md text-sm font-black transition";

type DatePickerCalendarProps = {
  value: string;
  viewYear: number;
  viewMonth: number;
  min?: string;
  max?: string;
  allowedWeekdays?: number[];
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
  onChange,
  onViewChange,
}: DatePickerCalendarProps) {
  const [today, setToday] = useState<string | null>(null);
  const weekdays = getWeekdayLabels();
  const days = useMemo(() => buildCalendarMonth(viewYear, viewMonth), [viewMonth, viewYear]);

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

      <div className="grid max-h-56 grid-cols-7 gap-1 overflow-y-auto p-2">
        {days.map((cell) => {
          const selected = cell.date === value;
          const disabled = isDateDisabled(cell.date, min, max, { allowedWeekdays });
          const isToday = cell.date === today;

          return (
            <button
              key={cell.date}
              type="button"
              disabled={disabled}
              onClick={() => onChange(cell.date)}
              className={`${dayButtonClass} ${
                selected
                  ? "bg-emerald-400 text-slate-950"
                  : disabled
                    ? "cursor-not-allowed bg-surface-panel text-slate-600 opacity-40"
                    : cell.inMonth
                      ? isToday
                        ? "border border-emerald-600/60 bg-surface-panel text-[#f8fafc] hover:bg-surface-card-hover"
                        : "bg-surface-panel text-[#f8fafc] hover:bg-surface-card-hover"
                      : "bg-surface-panel text-slate-500 opacity-55 hover:bg-surface-card-hover hover:opacity-80"
              }`}
              aria-label={cell.date}
              aria-pressed={selected}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
