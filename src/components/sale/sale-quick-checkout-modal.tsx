"use client";

import Link from "next/link";
import { Printer, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { QuickEmptyBoxDraft } from "@/components/sale/sale-quick-empty-box-modal";
import { PromotionSelector } from "@/components/sale/promotion-selector";
import {
  personFullName,
  SaleInvoicePaper,
  senderPhonesLabel,
} from "@/components/sale/venta-parts";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import { saleFinishActionLabel, type InvoiceBillingSnapshot } from "@/lib/invoice-billing";
import { SaleInvoiceConfirmDialog } from "@/components/sale/sale-invoice-confirm-dialog";
import { useState } from "react";

type SaleQuickCheckoutModalProps = {
  invoiceNumber: string;
  draft: QuickEmptyBoxDraft;
  billing: InvoiceBillingSnapshot | null;
  selectedPromotionId: string;
  onPromotionChange: (promotionId: string) => void;
  payNowDraft: string;
  payNowDraftTouched?: boolean;
  onPayNowDraftChange: (value: string) => void;
  completed?: boolean;
  stockMessage: string;
  onClose: () => void;
  onPrint: () => void;
  onConfirmCharge: () => boolean | Promise<boolean>;
  onStartNewSale: () => void;
  confirming?: boolean;
};

export function SaleQuickCheckoutModal({
  invoiceNumber,
  draft,
  billing,
  selectedPromotionId,
  onPromotionChange,
  payNowDraft,
  payNowDraftTouched = false,
  onPayNowDraftChange,
  completed = false,
  stockMessage,
  onClose,
  onPrint,
  onConfirmCharge,
  onStartNewSale,
  confirming = false,
}: SaleQuickCheckoutModalProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleConfirmCharge() {
    const created = await onConfirmCharge();
    if (created) {
      setConfirmOpen(false);
    }
  }

  return (
    <div className="no-print fixed inset-0 z-[130] flex items-center justify-center bg-[#163A2A] p-4">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-xl border border-black bg-surface-panel p-5 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-black pb-4">
          <div>
            <p className="text-sm font-black uppercase text-slate-400">
              {completed ? "Invoice creado" : saleFinishActionLabel(billing)}
            </p>
            <h3 className="text-3xl font-black">Invoice {invoiceNumber}</h3>
            <p className="font-bold text-slate-400">Depósito de caja vacía</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-black"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
          <div className="grid gap-4">
            <div className="no-print rounded-xl border border-black bg-surface-card p-4">
              <p className="text-xs font-black uppercase text-slate-500">Remitente</p>
              <p className="text-xl font-black">{personFullName(draft.sender)}</p>
              <p className="font-bold text-slate-400">{senderPhonesLabel(draft.sender)}</p>
            </div>

            <div className="flex flex-col items-center gap-4">
              <SaleInvoicePaper
                invoiceNumber={invoiceNumber}
                sender={draft.sender}
                box={draft.box}
                deliveryLine={draft.deliverySummary}
                billing={billing}
                payNowDraft={completed ? undefined : payNowDraft}
                payNowDraftTouched={completed ? false : payNowDraftTouched}
                onPayNowDraftChange={completed ? undefined : onPayNowDraftChange}
              />
              {!completed && billing && billing.promotionCandidates.length > 1 ? (
                <div className="no-print w-full max-w-[210mm]">
                  <PromotionSelector
                    candidates={billing.promotionCandidates}
                    selectedPromotionId={selectedPromotionId}
                    onChange={onPromotionChange}
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="no-print rounded-xl border border-black bg-surface-card p-4 text-center text-[#f8fafc]">
            <div className="rounded-lg bg-[#f8fafc] p-3">
              <QRCodeSVG value={`invoice:${invoiceNumber}`} size={144} level="M" marginSize={1} />
            </div>
            <p className="mt-3 text-lg font-black">{invoiceNumber}</p>
            <p className="text-sm font-bold text-slate-300">QR del invoice</p>
          </div>
        </div>

        {stockMessage ? (
          <p className="no-print mt-4 rounded-lg border border-black bg-surface-panel px-3 py-2 text-center text-sm font-bold text-emerald-200">
            {stockMessage}
          </p>
        ) : null}

        <div
          className={`no-print mt-5 grid gap-3 border-t border-black pt-4 ${completed ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
        >
          {completed ? (
            <>
              <button
                type="button"
                onClick={onPrint}
                className={`${secondaryButtonClass} flex h-14 items-center justify-center gap-2 text-lg font-black`}
              >
                <Printer className="h-6 w-6" />
                Imprimir
              </button>
              <Link
                href="/envios"
                className={`${secondaryButtonClass} flex h-14 items-center justify-center text-lg font-black`}
              >
                Ver en Envíos
              </Link>
              <button
                type="button"
                onClick={onStartNewSale}
                className={`${primaryButtonClass} h-14 text-lg font-black`}
              >
                Nueva venta
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={onClose} className="h-14 rounded-lg border border-black text-lg font-black">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={!billing || billing.promotionSelectionRequired || confirming}
                className="h-14 rounded-lg bg-emerald-400 text-lg font-black text-slate-950 disabled:opacity-40"
              >
                {billing?.promotionSelectionRequired
                  ? "Elige promocion"
                  : saleFinishActionLabel(billing)}
              </button>
            </>
          )}
        </div>

        <SaleInvoiceConfirmDialog
          open={confirmOpen}
          title="¿Crear este invoice?"
          invoiceLabel={`Factura ${invoiceNumber}`}
          lines={
            billing
              ? [
                  { label: "Remitente", value: personFullName(draft.sender) },
                  { label: "Total", value: billing.quotedTotal },
                  { label: "Depósito", value: billing.payNow },
                  { label: "Pendiente", value: billing.balanceDue },
                ]
              : []
          }
          confirmLabel={saleFinishActionLabel(billing)}
          confirming={confirming}
          onCancel={() => {
            if (!confirming) {
              setConfirmOpen(false);
            }
          }}
          onConfirm={() => void handleConfirmCharge()}
        />
      </div>
    </div>
  );
}
