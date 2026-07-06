"use client";

import { SalePaymentMethodField } from "@/components/sale/sale-payment-method-field";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import type { SalePaymentChoice } from "@/lib/sale-payment-choice";

type SaleInvoiceConfirmDialogProps = {
  open: boolean;
  title: string;
  invoiceLabel: string;
  lines: Array<{ label: string; value: string }>;
  confirmLabel: string;
  confirmingLabel?: string;
  confirming?: boolean;
  paymentMethod: SalePaymentChoice;
  paymentNote?: string;
  onPaymentMethodChange: (method: SalePaymentChoice) => void;
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

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-4">
      <div
        className="w-full max-w-md rounded-xl border border-black bg-surface-panel p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sale-invoice-confirm-title"
      >
        <p id="sale-invoice-confirm-title" className="text-xl font-black text-[#f8fafc]">
          {title}
        </p>
        <p className="mt-1 text-sm font-bold text-slate-400">{invoiceLabel}</p>

        <dl className="mt-4 grid gap-2 rounded-lg border border-black bg-surface-card px-3 py-3 text-sm">
          {lines.map((line) => (
            <div key={line.label} className="flex items-center justify-between gap-3">
              <dt className="font-bold text-slate-400">{line.label}</dt>
              <dd className="font-black tabular-nums text-[#f8fafc]">{line.value}</dd>
            </div>
          ))}
        </dl>

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
            disabled={confirming}
            className={`${primaryButtonClass} h-11 text-sm font-black disabled:opacity-40`}
          >
            {confirming ? confirmingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
