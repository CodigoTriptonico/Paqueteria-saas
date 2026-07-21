"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  logisticsCalendarDaySelectedClass,
  logisticsCalendarDayToneClass,
  type LogisticsCalendarDayTone,
} from "@/lib/logistics-calendar-day-tones";

export type LogisticsWeekdayFilterOption = {
  value: number;
  label: string;
};

export function LogisticsWeekdayFilterSelect({
  value,
  options,
  tones,
  onChange,
  ariaLabel,
  className = "",
}: {
  value: number;
  options: ReadonlyArray<LogisticsWeekdayFilterOption>;
  tones: Readonly<Partial<Record<number, LogisticsCalendarDayTone>>>;
  onChange: (weekday: number) => void;
  ariaLabel: string;
  className?: string;
}) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  const selectedTone = tones[value] || null;

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative shrink-0 ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex h-9 min-w-[10.5rem] items-center justify-between gap-2 rounded-lg px-2.5 text-sm font-black outline-none transition ${logisticsCalendarDayToneClass(selectedTone)}`}
        data-day-tone={selectedTone || undefined}
        title={selectedTone ? `${selected?.label || ""} · ${selectedTone}` : selected?.label}
      >
        <span className="truncate">{selected?.label || "Día"}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 top-[calc(100%+4px)] z-50 min-w-full overflow-hidden rounded-lg border border-black bg-surface-card shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
        >
          <ul className="py-1">
            {options.map((option) => {
              const tone = tones[option.value] || null;
              const isSelected = option.value === value;
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-day-tone={tone || undefined}
                    title={tone ? `${option.label} · ${tone}` : option.label}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={`mx-1 flex w-[calc(100%-0.5rem)] items-center rounded-md px-2.5 py-2 text-left text-sm font-black transition ${logisticsCalendarDayToneClass(tone)} ${logisticsCalendarDaySelectedClass(isSelected)}`}
                  >
                    {option.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
