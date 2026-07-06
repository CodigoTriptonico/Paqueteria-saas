"use client";

import { ChevronDown } from "lucide-react";
import { useRef } from "react";
import { inputClass } from "@/components/ui-blocks";
import {
  isSalePaymentChoice,
  SALE_PAYMENT_CHOICE_OPTIONS,
  salePaymentChoiceLabel,
  type SalePaymentChoice,
} from "@/lib/sale-payment-choice";

type SalePaymentMethodFieldProps = {
  value: SalePaymentChoice;
  note?: string;
  disabled?: boolean;
  className?: string;
  onChange: (value: SalePaymentChoice) => void;
  onNoteChange?: (note: string) => void;
};

function openPaymentSelect(select: HTMLSelectElement | null) {
  if (!select || select.disabled) {
    return;
  }

  select.focus();

  try {
    select.showPicker();
  } catch {
    select.click();
  }
}

export function SalePaymentMethodField({
  value,
  note = "",
  disabled = false,
  className = "",
  onChange,
  onNoteChange,
}: SalePaymentMethodFieldProps) {
  const selectRef = useRef<HTMLSelectElement>(null);
  const showNote = value !== "pending" && Boolean(onNoteChange);

  return (
    <div className={`rounded-lg border border-black bg-surface-card ${className}`}>
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <span className="shrink-0 text-xs font-black uppercase text-slate-500">Forma de pago</span>
        <button
          type="button"
          disabled={disabled}
          className="relative flex min-h-7 min-w-[8.5rem] items-center justify-end rounded-md px-1 text-right disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Forma de pago"
          aria-haspopup="listbox"
          onClick={() => openPaymentSelect(selectRef.current)}
        >
          <span className="pointer-events-none pr-5 text-sm font-black text-[#f8fafc]">
            {salePaymentChoiceLabel(value)}
          </span>
          <ChevronDown className="pointer-events-none absolute right-0 h-4 w-4 text-slate-400" aria-hidden />
          <select
            ref={selectRef}
            tabIndex={-1}
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0"
            value={value}
            disabled={disabled}
            onChange={(event) => {
              if (isSalePaymentChoice(event.target.value)) {
                onChange(event.target.value);
              }
            }}
          >
            {SALE_PAYMENT_CHOICE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </button>
      </div>

      {showNote ? (
        <div className="border-t border-black px-3 py-3">
          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase text-slate-500">Nota</span>
            <input
              className={inputClass}
              value={note}
              disabled={disabled}
              onChange={(event) => onNoteChange?.(event.target.value)}
              placeholder="Referencia, cheque, ultimos 4..."
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
