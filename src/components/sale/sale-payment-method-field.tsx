"use client";

import { ChevronDown } from "lucide-react";
import { useRef } from "react";
import { inputClass } from "@/components/ui-blocks";
import { formatMoneyValue, parseMoneyValue } from "@/lib/logistics-fees";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/payment-methods";
import {
  type SaleDepositChargeMode,
  resolveSaleDepositChargeAmount,
} from "@/lib/sale-deposit-charge";
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
  paidLabel?: string;
  pendingHint?: string;
  onChange: (paid: boolean) => void;
};

export function SaleDepositPaidToggle({
  paid,
  disabled = false,
  className = "",
  paidLabel = "Depósito pagado",
  pendingHint = "Desmárcalo para dejarlo pendiente.",
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
        aria-label={paidLabel}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-black text-[#f8fafc]">{paidLabel}</span>
        <span className="mt-0.5 block text-xs font-bold leading-snug text-slate-400">
          {pendingHint}
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

type SaleDepositChargeFieldProps = {
  mode: SaleDepositChargeMode;
  depositDraft: string;
  minimumDeposit: string;
  quotedTotal: number;
  paid: boolean;
  boxDetail?: string;
  promotionLabel?: string;
  deliveryLabel?: string;
  disabled?: boolean;
  className?: string;
  onModeChange: (mode: SaleDepositChargeMode) => void;
  onDepositDraftChange: (value: string) => void;
  onPaidChange: (paid: boolean) => void;
};

function chargeModeCardClass(selected: boolean) {
  return selected
    ? "border-emerald-400 bg-emerald-400/10"
    : "border-black bg-surface-inset hover:bg-[#3a4540]";
}

export function SaleDepositChargeField({
  mode,
  depositDraft,
  minimumDeposit,
  quotedTotal,
  paid,
  boxDetail = "",
  promotionLabel = "",
  deliveryLabel = "",
  disabled = false,
  className = "",
  onModeChange,
  onDepositDraftChange,
  onPaidChange,
}: SaleDepositChargeFieldProps) {
  const chargeAmount = resolveSaleDepositChargeAmount({
    mode,
    depositDraft,
    minimumDeposit,
    quotedTotal,
  });
  const balanceDue = Math.max(quotedTotal - chargeAmount, 0);
  const quotedLabel = formatMoneyValue(quotedTotal);
  const chargeLabel = formatMoneyValue(chargeAmount);
  const balanceLabel = formatMoneyValue(balanceDue);
  const minimumLabel = formatMoneyValue(
    Math.min(parseMoneyValue(minimumDeposit), Math.max(quotedTotal, 0)),
  );
  const isFull = mode === "full";
  const hasTotal = quotedTotal > 0;

  return (
    <div className={`rounded-xl border border-black bg-surface-card ${className}`}>
      <div className="border-b border-black px-4 py-3 text-center">
        <p className="text-xs font-black uppercase text-slate-500">Total de cajas</p>
        <p className="text-3xl font-black tabular-nums text-emerald-300">
          {hasTotal ? quotedLabel : "$0"}
        </p>
        <p className="mt-1 min-h-4 text-xs font-bold text-slate-400">
          {boxDetail || "Selecciona una caja"}
        </p>
        <p className="mt-1 min-h-4 text-xs font-black text-emerald-300">{promotionLabel}</p>
        <p className="mt-1 min-h-4 text-xs font-bold text-slate-400">{deliveryLabel}</p>
      </div>

      <div className="px-3 py-2.5">
        <p className="text-xs font-black uppercase text-slate-500">Cobro ahora</p>
        <p className="mt-1 text-xs font-bold leading-snug text-slate-400">
          Elige depósito o pago completo. La resta del pendiente se actualiza al instante.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Tipo de cobro">
          <button
            type="button"
            disabled={disabled || !hasTotal}
            aria-pressed={!isFull}
            onClick={() => onModeChange("deposit")}
            className={`rounded-lg border px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${chargeModeCardClass(!isFull)}`}
          >
            <span className="block text-sm font-black text-[#f8fafc]">Depósito</span>
            <span className="mt-0.5 block text-[11px] font-bold text-slate-400">
              Mínimo {minimumLabel}
            </span>
          </button>
          <button
            type="button"
            disabled={disabled || !hasTotal}
            aria-pressed={isFull}
            onClick={() => onModeChange("full")}
            className={`rounded-lg border px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${chargeModeCardClass(isFull)}`}
          >
            <span className="block text-sm font-black text-[#f8fafc]">Pago completo</span>
            <span className="mt-0.5 block text-[11px] font-bold text-slate-400">
              Total {quotedLabel}
            </span>
          </button>
        </div>

        <div
          className="mt-3 rounded-lg border border-black bg-surface-inset px-3 py-3"
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-bold text-slate-400">Total</span>
            <span className="font-black tabular-nums text-[#f8fafc]">{quotedLabel}</span>
          </div>

          <div className="mt-2.5 flex items-center justify-between gap-3">
            <span className="text-sm font-bold text-slate-400">
              − {isFull ? "Pago completo" : "Depósito"}
            </span>
            {isFull ? (
              <span className="text-sm font-black tabular-nums text-emerald-300">{chargeLabel}</span>
            ) : (
              <label className="flex h-10 min-w-[7.5rem] items-center gap-1 rounded-lg border border-black bg-[#202926] px-2.5">
                <span className="text-sm font-black text-slate-400">$</span>
                <input
                  className="w-full bg-transparent text-right text-sm font-black tabular-nums text-[#f8fafc] outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  value={depositDraft}
                  disabled={disabled || !hasTotal}
                  inputMode="numeric"
                  aria-label="Monto del depósito"
                  placeholder={minimumLabel.replace(/^\$/, "")}
                  onChange={(event) =>
                    onDepositDraftChange(event.target.value.replace(/[^\d]/g, ""))
                  }
                />
              </label>
            )}
          </div>

          <div className="my-3 border-t border-dashed border-slate-600" />

          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                Queda debiendo
              </p>
              <p className="mt-0.5 text-xs font-bold text-slate-400">
                {balanceDue > 0
                  ? `${quotedLabel} − ${chargeLabel}`
                  : "Todo cubierto con este cobro"}
              </p>
            </div>
            <p
              className={`text-3xl font-black tabular-nums leading-none ${
                balanceDue > 0 ? "text-amber-300" : "text-emerald-300"
              }`}
            >
              {balanceLabel}
            </p>
          </div>
        </div>

        <SaleDepositPaidToggle
          className="mt-3"
          paid={paid}
          disabled={disabled}
          paidLabel={isFull ? "Pago completo recibido" : "Depósito pagado"}
          pendingHint={
            isFull
              ? "Desmárcalo para dejar el total pendiente."
              : "Desmárcalo para dejarlo pendiente."
          }
          onChange={onPaidChange}
        />
      </div>
    </div>
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
