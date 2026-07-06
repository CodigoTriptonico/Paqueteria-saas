"use client";

import { CalendarDays } from "lucide-react";
import { useRef } from "react";
import { openNativePicker } from "@/lib/native-picker";

function openDatePicker(input: HTMLInputElement | null) {
  openNativePicker(input);
}

const fieldClass =
  "min-w-0 flex-1 border-0 bg-transparent p-0 font-black leading-none text-[#f8fafc] outline-none [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:hidden";

export type DateInputProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
  min?: string;
  max?: string;
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
  disabled = false,
  className = "",
  ariaLabel,
  compact = true,
  embedded = false,
}: DateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const shellClass = embedded
    ? "flex min-w-0 flex-1 items-center gap-1"
    : compact
      ? "flex h-9 items-center gap-1 rounded-lg border border-black bg-surface-inset px-2"
      : "flex h-11 items-center gap-1.5 rounded-lg border border-black bg-surface-inset px-3";

  const textClass = compact ? "text-sm" : "text-sm";

  return (
    <div className={`${shellClass} ${className}`}>
      <input
        ref={inputRef}
        type="date"
        className={`${fieldClass} ${textClass}`}
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        aria-label={ariaLabel}
        onClick={() => openDatePicker(inputRef.current)}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => onBlur?.(inputRef.current?.value ?? value)}
      />
      <button
        type="button"
        disabled={disabled}
        className="inline-flex shrink-0 items-center text-slate-400 transition hover:text-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => openDatePicker(inputRef.current)}
        aria-label={`Abrir calendario: ${ariaLabel}`}
        tabIndex={-1}
      >
        <CalendarDays
          className={compact ? "h-3.5 w-3.5" : "h-4 w-4"}
          strokeWidth={2.5}
          aria-hidden
        />
      </button>
    </div>
  );
}
