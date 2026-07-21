"use client";

import { ChevronDown } from "lucide-react";
import { useRef } from "react";
import { inputClass } from "@/components/ui-blocks";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/payment-methods";
import {
  isSalePaymentChoice,
  SALE_PAYMENT_UNSET,
  salePaymentChoiceLabel,
  type SalePaymentSelection,
} from "@/lib/sale-payment-choice";

type SalePaymentMethodFieldProps = {
  value: SalePaymentSelection;
  note?: string;
  pendingPaymentAmount?: string;
  disabled?: boolean;
  confirming?: boolean;
  className?: string;
  onChange: (value: SalePaymentSelection) => void;
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

type PaymentMethodSelectorProps = {
  value: SalePaymentSelection;
  note: string;
  disabled: boolean;
  onChange: (value: SalePaymentSelection) => void;
  onNoteChange?: (note: string) => void;
};

function PaymentMethodSelector({
  value,
  note,
  disabled,
  onChange,
  onNoteChange,
}: PaymentMethodSelectorProps) {
  const selectRef = useRef<HTMLSelectElement>(null);
  const selectedMethod = isSalePaymentChoice(value) && value !== "pending" ? value : "cash";

  return (
    <>
      <label className="grid gap-1.5">
        <span className="text-xs font-black uppercase text-slate-500">Forma de pago recibida ahora</span>
        <button
          type="button"
          disabled={disabled}
          className="relative flex h-10 items-center justify-between rounded-lg border border-black bg-surface-inset px-3 text-left disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Forma de pago recibida ahora"
          aria-haspopup="listbox"
          onClick={() => openPaymentSelect(selectRef.current)}
        >
          <span className="pointer-events-none text-sm font-black text-[#f8fafc]">
            {salePaymentChoiceLabel(selectedMethod)}
          </span>
          <ChevronDown className="pointer-events-none h-4 w-4 text-slate-400" aria-hidden />
          <select
            ref={selectRef}
            tabIndex={-1}
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0"
            value={selectedMethod}
            disabled={disabled}
            onChange={(event) => {
              if (isSalePaymentChoice(event.target.value) && event.target.value !== "pending") {
                onChange(event.target.value);
              }
            }}
          >
            {PAYMENT_METHOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </button>
      </label>

      <label className="grid gap-1.5">
        <span className="mt-3 text-xs font-black uppercase text-slate-500">Nota</span>
        <input
          className={inputClass}
          value={note}
          disabled={disabled}
          onChange={(event) => onNoteChange?.(event.target.value)}
          placeholder="Referencia, cheque, ultimos 4..."
        />
      </label>
    </>
  );
}

export function SalePaymentMethodField({
  value,
  note = "",
  pendingPaymentAmount = "$0",
  disabled = false,
  confirming = false,
  className = "",
  onChange,
  onNoteChange,
}: SalePaymentMethodFieldProps) {
  const paymentUnset = value === SALE_PAYMENT_UNSET;
  const paymentPending = value === "pending";
  const collectingNow = !paymentPending;
  const pendingPaymentMessage = `El depósito de ${pendingPaymentAmount} queda pendiente. No se registra en caja hasta que se cobre.`;

  function toggleDepositPending(checked: boolean) {
    if (disabled || confirming) {
      return;
    }

    if (checked) {
      onChange("pending");
      onNoteChange?.("");
      return;
    }

    onChange("cash");
  }

  return (
    <div className={`rounded-lg border border-black bg-surface-card ${className}`}>
      <div className="px-3 py-2.5">
        <p className="text-xs font-black uppercase text-slate-500">Cobro del depósito</p>
        <p className="mt-1 text-xs font-bold leading-snug text-slate-400">
          Si el dinero no entró, marca el depósito como pendiente.
        </p>

        <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-lg border border-black bg-surface-inset px-3 py-2.5">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-400"
            checked={paymentPending}
            disabled={disabled}
            aria-label="Depósito pendiente"
            onChange={(event) => toggleDepositPending(event.target.checked)}
          />
          <span className="min-w-0">
            <span className="block text-xs font-black text-[#f8fafc]">Depósito pendiente</span>
            <span className="mt-0.5 block text-xs font-bold leading-snug text-slate-400">
              Actívalo solo si el depósito todavía no fue pagado.
            </span>
          </span>
        </label>
      </div>

      {paymentPending ? (
        <div className="border-t border-black px-3 py-3">
          <p className="text-xs font-black uppercase text-amber-300">Estado: pendiente</p>
          <p className="mt-1.5 text-xs font-bold leading-snug text-slate-300">{pendingPaymentMessage}</p>
        </div>
      ) : (
        <div className="border-t border-black px-3 py-3">
          <PaymentMethodSelector
            value={collectingNow && paymentUnset ? "cash" : value}
            note={note}
            disabled={disabled}
            onChange={onChange}
            onNoteChange={onNoteChange}
          />
        </div>
      )}
    </div>
  );
}
