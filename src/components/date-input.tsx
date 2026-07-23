"use client";

import { CalendarDays } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DatePickerCalendar } from "@/components/date-picker-calendar";
import { formatDateInputDisplay, PICKER_PANEL_SELECTOR, resolveCalendarView } from "@/lib/date-picker";
import type { LogisticsCalendarDayTone } from "@/lib/logistics-calendar-day-tones";
import { insetShellClass } from "@/components/ui-blocks";

const shellBaseClass =
  `${insetShellClass} box-border inline-flex min-w-0 items-center gap-2 rounded-lg border border-solid border-black bg-surface-inset`;

const triggerClass =
  "inset-field flex min-h-0 min-w-0 flex-1 items-center truncate border-0 bg-transparent p-0 text-left text-sm font-black leading-none text-[#f8fafc] outline-none";

const trailingClass =
  "inline-flex h-4 w-4 shrink-0 items-center justify-center self-center text-slate-400 transition hover:text-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50";

export type DateInputProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
  min?: string;
  max?: string;
  allowedWeekdays?: number[];
  dayTones?: Readonly<Record<string, LogisticsCalendarDayTone>>;
  showToneLegend?: boolean;
  disabled?: boolean;
  className?: string;
  ariaLabel: string;
  compact?: boolean;
  embedded?: boolean;
};

export function DateInput({
  value,
  onChange,
  onBlur,
  min,
  max,
  allowedWeekdays,
  dayTones,
  showToneLegend = false,
  disabled = false,
  className = "",
  ariaLabel,
  compact = true,
  embedded = false,
}: DateInputProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const initialView = resolveCalendarView(value);
  const [viewYear, setViewYear] = useState(initialView.year);
  const [viewMonth, setViewMonth] = useState(initialView.month);

  const shellClass = embedded
    ? `${shellBaseClass} h-9 min-w-[11.5rem] w-[12.75rem] px-2.5`
    : compact
      ? `${shellBaseClass} h-9 min-w-0 px-2.5`
      : `${shellBaseClass} h-11 min-w-0 px-3`;

  const updatePanelPosition = useCallback(() => {
    const trigger = triggerRef.current;

    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();

    setPanelPosition({
      top: rect.bottom + 6,
      left: rect.left,
    });
  }, []);

  const openPicker = useCallback(() => {
    if (disabled) {
      return;
    }

    const nextView = resolveCalendarView(value);
    setViewYear(nextView.year);
    setViewMonth(nextView.month);
    updatePanelPosition();
    setOpen(true);
  }, [disabled, updatePanelPosition, value]);

  const closePicker = useCallback(() => {
    setOpen(false);
    setPanelPosition(null);
    onBlur?.(value);
  }, [onBlur, value]);

  const pickDate = useCallback(
    (nextValue: string) => {
      onChange(nextValue);
      setOpen(false);
      setPanelPosition(null);
      onBlur?.(nextValue);
    },
    [onBlur, onChange],
  );

  const togglePicker = useCallback(() => {
    if (open) {
      closePicker();
      return;
    }

    openPicker();
  }, [closePicker, open, openPicker]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const close = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (triggerRef.current?.contains(target)) {
        return;
      }

      if (target instanceof Element && target.closest(PICKER_PANEL_SELECTOR)) {
        return;
      }

      closePicker();
    };

    window.addEventListener("pointerdown", close);
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);

    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [closePicker, open, updatePanelPosition]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        className={`${shellClass} ${className}`}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={togglePicker}
      >
        <span className={`${triggerClass} pointer-events-none`}>
          {formatDateInputDisplay(value)}
        </span>
        <span className={`${trailingClass} pointer-events-none`} aria-hidden>
          <CalendarDays className="h-4 w-4" strokeWidth={2.25} />
        </span>
      </button>

      {open && panelPosition ? (
        <div
          className="fixed z-[160]"
          style={{
            top: panelPosition.top,
            left: panelPosition.left,
          }}
        >
          <DatePickerCalendar
            value={value}
            viewYear={viewYear}
            viewMonth={viewMonth}
            min={min}
            max={max}
            allowedWeekdays={allowedWeekdays}
            dayTones={dayTones}
            showToneLegend={showToneLegend}
            onChange={pickDate}
            onViewChange={(year, month) => {
              setViewYear(year);
              setViewMonth(month);
            }}
          />
        </div>
      ) : null}
    </>
  );
}
