"use client";

import { logisticsWeekdayChipLabels } from "@/lib/logistics-day-route";

export function LogisticsWeekdayPicker({
  value,
  availableWeekdays,
  onChange,
  disabled = false,
  ariaLabel,
}: {
  value: number;
  availableWeekdays: ReadonlyArray<number>;
  onChange: (weekday: number) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  const available = new Set(availableWeekdays.map((day) => Number(day)));

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="grid grid-cols-7 gap-1.5"
    >
      {logisticsWeekdayChipLabels.map((label, weekday) => {
        const enabled = available.has(weekday);
        const selected = value === weekday;
        const chipDisabled = disabled || !enabled;

        return (
          <button
            key={label}
            type="button"
            disabled={chipDisabled}
            aria-pressed={selected}
            aria-label={label}
            onClick={() => onChange(weekday)}
            className={`h-9 rounded-lg border text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${
              selected
                ? "border-emerald-500 bg-emerald-400/20 text-emerald-100"
                : enabled
                  ? "border-black bg-surface-inset text-[#f8fafc] hover:bg-surface-card-hover"
                  : "border-black bg-surface-inset text-slate-500"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
