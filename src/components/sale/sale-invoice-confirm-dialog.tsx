"use client";

import { SalePaymentMethodField } from "@/components/sale/sale-payment-method-field";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import { isSalePaymentUnset, type SalePaymentSelection } from "@/lib/sale-payment-choice";

type SaleInvoiceConfirmDialogProps = {
  open: boolean;
  title: string;
  invoiceLabel: string;
  lines: Array<{ label: string; value: string }>;
  confirmLabel: string;
  confirmingLabel?: string;
  confirming?: boolean;
  errorMessage?: string;
  paymentMethod: SalePaymentSelection;
  paymentNote?: string;
  onPaymentMethodChange: (method: SalePaymentSelection) => void;
  onPaymentNoteChange?: (note: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function SaleInvoiceConfirmDialog({
  open,
  title,
  invoiceLabel,
  lines,
  confirmLabel,
  confirmingLabel = "Creando...",
  confirming = false,
  errorMessage = "",
  paymentMethod,
  paymentNote = "",
  onPaymentMethodChange,
  onPaymentNoteChange,
  onCancel,
  onConfirm,
}: SaleInvoiceConfirmDialogProps) {
  if (!open) {
    return null;
  }

  const paymentSelectionRequired = isSalePaymentUnset(paymentMethod);

  return (
    <div className="app-modal-overlay fixed inset-0 z-[140] flex justify-center bg-black/70 p-3 sm:p-4">
      <div
        className="app-modal-content w-full max-w-md rounded-xl border border-black bg-surface-panel p-4 shadow-2xl sm:p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sale-invoice-confirm-title"
      >
        <p id="sale-invoice-confirm-title" className="text-xl font-black text-[#f8fafc]">
          {title}
        </p>
        <p className="mt-1 break-words text-sm font-bold text-slate-400">{invoiceLabel}</p>

        <dl className="mt-4 divide-y divide-black/70 border-y border-black/70 text-sm">
          {lines.map((line) => (
            <div key={line.label} className="flex items-start justify-between gap-3 py-2">
              <dt className="font-bold text-slate-400">{line.label}</dt>
              <dd className="min-w-0 break-words text-right font-black tabular-nums text-[#f8fafc]">{line.value}</dd>
            </div>
          ))}
        </dl>

        <SalePaymentMethodField
          className="mt-4"
          value={paymentMethod}
          note={paymentNote}
          pendingPaymentAmount={lines.find((line) => line.label === "Depósito")?.value}
          disabled={confirming}
          confirming={confirming}
          onChange={onPaymentMethodChange}
          onNoteChange={onPaymentNoteChange}
        />

        {errorMessage ? (
          <p
            className="mt-3 rounded-lg border border-rose-700 bg-rose-950/40 px-3 py-2 text-sm font-bold text-rose-200"
            role="alert"
          >
            {errorMessage}
          </p>
        ) : null}

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
            disabled={confirming || paymentSelectionRequired}
            className={`${primaryButtonClass} h-11 text-sm font-black disabled:opacity-40`}
          >
            {confirming
              ? confirmingLabel
              : paymentSelectionRequired
                ? "Elige cómo cobrar"
                : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
