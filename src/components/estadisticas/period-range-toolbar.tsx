"use client";

import { DateInput } from "@/components/date-input";

type RangeDateFieldProps = {
  label: string;
  field: "from" | "to";
  value: string;
  otherValue: string;
  disabled?: boolean;
  onApply: (rangeFrom: string, rangeTo: string) => void;
};

function RangeDateField({
  label,
  field,
  value,
  otherValue,
  disabled,
  onApply,
}: RangeDateFieldProps) {
  function commitValue(nextValue: string) {
    if (!nextValue) {
      return;
    }

    const nextFrom = field === "from" ? nextValue : otherValue;
    const nextTo = field === "to" ? nextValue : otherValue;
    onApply(nextFrom, nextTo);
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5 px-2">
      <span className="shrink-0 text-[9px] font-black uppercase leading-none text-slate-500">
        {label}
      </span>
      <DateInput
        embedded
        value={value}
        disabled={disabled}
        ariaLabel={`Fecha ${label.toLowerCase()}`}
        onChange={commitValue}
        onBlur={(nextValue) => commitValue(nextValue)}
      />
    </div>
  );
}

type PeriodRangeToolbarProps = {
  rangeFrom: string;
  rangeTo: string;
  disabled?: boolean;
  onApply: (rangeFrom: string, rangeTo: string) => void;
};

export function PeriodRangeToolbar({
  rangeFrom,
  rangeTo,
  disabled,
  onApply,
}: PeriodRangeToolbarProps) {
  return (
    <div
      className="flex h-9 min-w-[15rem] flex-[1_1_16rem] items-stretch divide-x divide-black overflow-hidden rounded-lg border border-black bg-surface-inset sm:max-w-[20rem]"
      role="group"
      aria-label="Rango de fechas"
    >
      <RangeDateField
        label="Desde"
        field="from"
        value={rangeFrom}
        otherValue={rangeTo}
        disabled={disabled}
        onApply={onApply}
      />
      <RangeDateField
        label="Hasta"
        field="to"
        value={rangeTo}
        otherValue={rangeFrom}
        disabled={disabled}
        onApply={onApply}
      />
    </div>
  );
}
