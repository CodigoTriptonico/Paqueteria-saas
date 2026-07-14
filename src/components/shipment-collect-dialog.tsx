"use client";

import { ChevronLeft } from "lucide-react";
import { SalePaymentMethodField } from "@/components/sale/sale-payment-method-field";
import {
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui-blocks";
import { formatMoneyValue, moneyInputDisplayValue, normalizeMoneyInput } from "@/lib/logistics-fees";
import type { SalePaymentSelection } from "@/lib/sale-payment-choice";
import {
  shipmentCollectCopy,
  type ShipmentCollectMode,
} from "@/lib/shipment-collect";

type ShipmentCollectDialogProps = {
  open: boolean;
  invoiceCode: string;
  customerName: string;
  total: number;
  deposit: number;
  balanceDue: number;
  mode: ShipmentCollectMode;
  partialAmount: string;
  paymentMethod: SalePaymentSelection;
  paymentNote?: string;
  confirming?: boolean;
  onModeChange: (mode: ShipmentCollectMode) => void;
  onPartialAmountChange: (value: string) => void;
  onPaymentMethodChange: (method: SalePaymentSelection) => void;
  onPaymentNoteChange?: (note: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ShipmentCollectDialog({
  open,
  invoiceCode,
  customerName,
  total,
  deposit,
  balanceDue,
  mode,
  partialAmount,
  paymentMethod,
  paymentNote = "",
  confirming = false,
  onModeChange,
  onPartialAmountChange,
  onPaymentMethodChange,
  onPaymentNoteChange,
  onCancel,
  onConfirm,
}: ShipmentCollectDialogProps) {
  if (!open) {
    return null;
  }

  const copy = shipmentCollectCopy(balanceDue, mode);
  const partialAmountValue = parseMoneyValueSafe(partialAmount);
  const projectedBalance = Math.max(balanceDue - partialAmountValue, 0);
  const canConfirmPartial = partialAmountValue > 0 && partialAmountValue <= balanceDue;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-4">
      <div
        className="w-full max-w-md rounded-xl border border-black bg-surface-panel p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shipment-collect-title"
      >
        <div className="flex items-start gap-2">
          {mode !== "choose" ? (
            <button
              type="button"
              onClick={() => onModeChange("choose")}
              disabled={confirming}
              className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-black bg-surface-inset text-slate-300 hover:bg-surface-card disabled:opacity-40"
              aria-label="Volver"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <p id="shipment-collect-title" className="text-xl font-black text-[#f8fafc]">
              {copy.title}
            </p>
            <p className="mt-1 text-sm font-bold text-slate-400">
              {invoiceCode} · {customerName}
            </p>
          </div>
        </div>

        {mode === "choose" ? (
          <>
            <dl className="mt-4 grid gap-2 rounded-lg border border-black bg-surface-card px-3 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="font-bold text-slate-400">Total</dt>
                <dd className="font-black tabular-nums text-[#f8fafc]">{formatMoneyValue(total)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="font-bold text-slate-400">Pagado</dt>
                <dd className="font-black tabular-nums text-emerald-300">{formatMoneyValue(deposit)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="font-bold text-slate-400">Pendiente</dt>
                <dd className="font-black tabular-nums text-amber-300">{formatMoneyValue(balanceDue)}</dd>
              </div>
            </dl>

            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={() => onModeChange("full")}
                disabled={confirming}
                className={`${primaryButtonClass} h-auto min-h-11 px-4 py-3 text-left disabled:opacity-40`}
              >
                <span className="block text-sm font-black">{copy.fullOptionLabel}</span>
                <span className="mt-0.5 block text-xs font-bold text-slate-950/70">
                  {copy.fullOptionDetail}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onModeChange("partial")}
                disabled={confirming}
                className={`${secondaryButtonClass} h-auto min-h-11 px-4 py-3 text-left disabled:opacity-40`}
              >
                <span className="block text-sm font-black text-[#f8fafc]">{copy.partialOptionLabel}</span>
                <span className="mt-0.5 block text-xs font-bold text-slate-400">
                  {copy.partialOptionDetail}
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={onCancel}
              disabled={confirming}
              className={`${secondaryButtonClass} mt-4 h-11 w-full text-sm font-black disabled:opacity-40`}
            >
              Cancelar
            </button>
          </>
        ) : (
          <>
            <dl className="mt-4 grid gap-2 rounded-lg border border-black bg-surface-card px-3 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="font-bold text-slate-400">Total</dt>
                <dd className="font-black tabular-nums text-[#f8fafc]">{formatMoneyValue(total)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="font-bold text-slate-400">Pagado</dt>
                <dd className="font-black tabular-nums text-emerald-300">{formatMoneyValue(deposit)}</dd>
              </div>
              {mode === "full" ? (
                <div className="flex items-center justify-between gap-3">
                  <dt className="font-bold text-slate-400">{copy.pendingLineLabel}</dt>
                  <dd className="font-black tabular-nums text-amber-300">
                    {formatMoneyValue(balanceDue)}
                  </dd>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="font-bold text-slate-400">Pendiente</dt>
                    <dd className="font-black tabular-nums text-amber-300">
                      {formatMoneyValue(balanceDue)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="font-bold text-slate-400">{copy.pendingLineLabel}</dt>
                    <dd className="font-black tabular-nums text-[#f8fafc]">
                      {formatMoneyValue(projectedBalance)}
                    </dd>
                  </div>
                </>
              )}
            </dl>

            {mode === "partial" ? (
              <label className="mt-4 grid gap-1.5 text-xs font-black uppercase text-slate-400">
                {copy.amountLabel}
                <div className="flex items-center gap-1">
                  <span className="text-sm font-black text-slate-300">$</span>
                  <input
                    className={`${inputClass} h-11 flex-1 text-sm tabular-nums`}
                    inputMode="decimal"
                    placeholder={moneyInputDisplayValue(formatMoneyValue(balanceDue)) || "0"}
                    value={moneyInputDisplayValue(partialAmount)}
                    disabled={confirming}
                    onChange={(event) =>
                      onPartialAmountChange(normalizeMoneyInput(event.target.value))
                    }
                    autoFocus
                  />
                </div>
              </label>
            ) : null}

            <SalePaymentMethodField
              className="mt-4"
              value={paymentMethod}
              note={paymentNote}
              disabled={confirming}
              onChange={onPaymentMethodChange}
              onNoteChange={onPaymentNoteChange}
            />

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={confirming}
                className={`${secondaryButtonClass} h-11 text-sm font-black disabled:opacity-40`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={confirming || (mode === "partial" && !canConfirmPartial)}
                className={`${primaryButtonClass} h-11 text-sm font-black disabled:opacity-40`}
              >
                {confirming ? copy.confirmingLabel : copy.confirmLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function parseMoneyValueSafe(value: string) {
  return Number(value.replace(/[^\d.-]/g, "")) || 0;
}
