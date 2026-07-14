"use client";

import { ChevronDown } from "lucide-react";
import { useRef } from "react";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
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
  pendingPaymentSource?: "driver" | "office";
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

export function SalePaymentMethodField({
  value,
  note = "",
  pendingPaymentSource = "driver",
  pendingPaymentAmount = "$0",
  disabled = false,
  confirming = false,
  className = "",
  onChange,
  onNoteChange,
}: SalePaymentMethodFieldProps) {
  const selectRef = useRef<HTMLSelectElement>(null);
  const paymentUnset = value === SALE_PAYMENT_UNSET;
  const paymentPending = value === "pending";
  const counterPaymentSelected = !paymentUnset && !paymentPending;
  const driverCollects = pendingPaymentSource === "driver";
  const pendingPaymentMessage = driverCollects
    ? `El invoice impreso llevará el depósito de ${pendingPaymentAmount} para que el cliente sepa cuánto pagar al conductor. En el programa quedará como no recibido hasta que el conductor registre el cobro al entregar la caja.`
    : `Este invoice quedará registrado con ${pendingPaymentAmount}, pero el dinero no se registrará en caja porque todavía no ha entrado.`;

  function choosePendingPayment() {
    if (disabled || confirming || paymentPending) {
      return;
    }

    onChange("pending");
    onNoteChange?.("");
  }

  function chooseCounterPayment() {
    onChange("cash");
  }

  return (
    <div className={`rounded-lg border border-black bg-surface-card ${className}`}>
      <div className="px-3 py-2.5">
        <p className="text-xs font-black uppercase text-slate-500">¿Cómo se cobra el depósito?</p>
        <p className="mt-1 text-xs font-bold leading-snug text-slate-400">
          {driverCollects
            ? "Elige si ya recibiste el dinero o si el conductor debe cobrarlo al entregar la caja."
            : "Elige si cobras ahora o si el pago queda pendiente en la oficina."}
        </p>

        <div className="mt-2.5 grid gap-2">
          <button
            type="button"
            disabled={disabled}
            aria-pressed={paymentPending}
            className={`${paymentPending ? primaryButtonClass : secondaryButtonClass} h-10 justify-between gap-3 px-3 text-left text-xs disabled:opacity-50`}
            onClick={choosePendingPayment}
          >
            <span className="font-black">{driverCollects ? "Conductor cobra" : "Dejar pendiente"}</span>
          </button>
          <button
            type="button"
            disabled={disabled}
            aria-pressed={counterPaymentSelected}
            className={`${counterPaymentSelected ? primaryButtonClass : secondaryButtonClass} h-10 justify-between gap-3 px-3 text-left text-xs disabled:opacity-50`}
            onClick={chooseCounterPayment}
          >
            <span className="font-black">Cobrar ahora</span>
          </button>
        </div>
      </div>

      {paymentPending ? (
        <div className="border-t border-black px-3 py-3">
          <p className="text-xs font-black uppercase text-slate-500">
            {driverCollects ? "Cobro pendiente del conductor" : "Pago pendiente en oficina"}
          </p>
          <p className="mt-1.5 text-xs font-bold leading-snug text-slate-300">{pendingPaymentMessage}</p>
        </div>
      ) : null}

      {counterPaymentSelected ? (
        <div className="border-t border-black px-3 py-3">
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
                {isSalePaymentChoice(value) ? salePaymentChoiceLabel(value) : "Efectivo"}
              </span>
              <ChevronDown className="pointer-events-none h-4 w-4 text-slate-400" aria-hidden />
              <select
                ref={selectRef}
                tabIndex={-1}
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-0"
                value={isSalePaymentChoice(value) ? value : "cash"}
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
        </div>
      ) : null}
    </div>
  );
}
