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

type SaleDepositPaidToggleProps = {
  paid: boolean;
  disabled?: boolean;
  className?: string;
  onChange: (paid: boolean) => void;
};

export function SaleDepositPaidToggle({
  paid,
  disabled = false,
  className = "",
  onChange,
}: SaleDepositPaidToggleProps) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-lg border border-black bg-surface-inset px-3 py-2.5 ${className}`}
    >
      <input
        type="checkbox"
        className="h-4 w-4 shrink-0 accent-emerald-400"
        checked={paid}
        disabled={disabled}
        aria-label="Depósito pagado"
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-black text-[#f8fafc]">Depósito pagado</span>
        <span className="mt-0.5 block text-xs font-bold leading-snug text-slate-400">
          Desmárcalo para dejarlo pendiente.
        </span>
      </span>
      <span
        className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-black uppercase ${
          paid ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/15 text-amber-200"
        }`}
      >
        {paid ? "Pagado" : "Pendiente"}
      </span>
    </label>
  );
}

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

  function toggleDepositPaid(paid: boolean) {
    if (disabled || confirming) {
      return;
    }

    if (paid) {
      onChange("cash");
      return;
    }

    onChange("pending");
    onNoteChange?.("");
  }

  return (
    <div className={`rounded-lg border border-black bg-surface-card ${className}`}>
      <div className="px-3 py-2.5">
        <p className="text-xs font-black uppercase text-slate-500">Cobro del depósito</p>
        <p className="mt-1 text-xs font-bold leading-snug text-slate-400">
          Se considera pagado por defecto. Desmárcalo si el dinero todavía no entró.
        </p>
        <SaleDepositPaidToggle
          className="mt-3"
          paid={!paymentPending}
          disabled={disabled || confirming}
          onChange={toggleDepositPaid}
        />
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
