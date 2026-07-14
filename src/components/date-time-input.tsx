"use client";

import { DateInput } from "@/components/date-input";
import { TimePickerInput } from "@/components/time-picker-input";
import { joinDateTimeInput, splitDateTimeInput } from "@/lib/date-picker";

type DateTimeInputProps = {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel: string;
};

export function DateTimeInput({
  value,
  onChange,
  min,
  disabled = false,
  className = "",
  ariaLabel,
}: DateTimeInputProps) {
  const { date, time } = splitDateTimeInput(value);
  const minDate = min?.split("T")[0];

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <DateInput
        value={date}
        min={minDate}
        disabled={disabled}
        ariaLabel={`Fecha de ${ariaLabel}`}
        onChange={(nextDate) => onChange(joinDateTimeInput(nextDate, time))}
      />
      <TimePickerInput
        value={time}
        disabled={disabled || !date}
        className="w-[9.5rem] shrink-0"
        ariaLabel={ariaLabel}
        onChange={(nextTime) => onChange(joinDateTimeInput(date, nextTime))}
      />
    </div>
  );
}
