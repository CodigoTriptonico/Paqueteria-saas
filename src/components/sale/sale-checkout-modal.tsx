"use client";

import { Printer, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  personFullName,
  type Recipient,
  type Sender,
  senderPhonesLabel,
} from "@/components/sale/venta-parts";
import { CountryName } from "@/components/country-flag";

type SaleCheckoutModalProps = {
  invoiceNumber: string;
  sender: Sender;
  recipient: Recipient;
  box: string[];
  deliverySummary: string;
  stockMessage: string;
  onClose: () => void;
  onPrint: () => void;
  onConfirmCharge: () => void;
};

export function SaleCheckoutModal({
  invoiceNumber,
  sender,
  recipient,
  box,
  deliverySummary,
  stockMessage,
  onClose,
  onPrint,
  onConfirmCharge,
}: SaleCheckoutModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#163A2A] p-4">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-xl border border-black bg-surface-panel p-5 shadow-2xl border-black bg-surface-panel">
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-black pb-4 border-black">
          <div>
            <p className="text-sm font-black uppercase text-slate-400">Confirmar venta</p>
            <h3 className="text-3xl font-black">Invoice {invoiceNumber}</h3>
            <p className="font-bold text-slate-400">Boxario - venta correlativa</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-black border-black"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-black bg-surface-card p-4 border-black bg-surface-card">
                <p className="text-xs font-black uppercase text-slate-500">Remitente</p>
                <p className="text-xl font-black">{personFullName(sender)}</p>
                <p className="font-bold text-slate-400">{senderPhonesLabel(sender)}</p>
                {sender.email ? (
                  <p className="text-sm font-bold text-slate-300">{sender.email}</p>
                ) : null}
              </div>
              <div className="rounded-xl border border-black bg-surface-card p-4 border-black bg-surface-card">
                <p className="text-xs font-black uppercase text-slate-500">Destinatario</p>
                <p className="text-xl font-black">{personFullName(recipient)}</p>
                <p className="font-bold text-slate-400">
                  {recipient.city}
                  {recipient.city && recipient.country ? ", " : null}
                  {recipient.country ? (
                    <CountryName
                      name={recipient.country}
                      size="xs"
                      className="inline-flex align-middle"
                      labelClassName="font-bold text-slate-400"
                    />
                  ) : null}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-black p-4 border-black">
              <p className="mb-3 text-xl font-black">Detalle</p>
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-xs font-black uppercase text-slate-500">Caja</p>
                  <p className="font-black">{box[0]}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase text-slate-500">Carrier</p>
                  <p className="font-black">{box[3]}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase text-slate-500">Tiempo</p>
                  <p className="font-black">{box[4]}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase text-slate-500">Pais</p>
                  <CountryName
                    name={recipient.country}
                    size="sm"
                    labelClassName="font-black"
                  />
                </div>
                <div>
                  <p className="text-xs font-black uppercase text-slate-500">Logistica</p>
                  <p className="font-black">{deliverySummary}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-black bg-surface-card p-4 text-right border-black bg-surface-card">
              <p className="text-xs font-black uppercase text-slate-500">Cliente paga</p>
              <p className="text-3xl font-black">{box[1]}</p>
            </div>
          </div>

          <div className="rounded-xl border border-black bg-surface-card p-4 text-center text-[#f8fafc]">
            <div className="rounded-lg bg-[#f8fafc] p-3">
              <QRCodeSVG value={`invoice:${invoiceNumber}`} size={144} level="M" marginSize={1} />
            </div>
            <p className="mt-3 text-lg font-black">{invoiceNumber}</p>
            <p className="text-sm font-bold text-slate-300">QR del invoice</p>
          </div>
        </div>

        {stockMessage ? (
          <p className="mt-4 rounded-lg border border-black bg-surface-panel px-3 py-2 text-center text-sm font-bold text-emerald-200">
            {stockMessage}
          </p>
        ) : null}

        <div className="mt-5 grid gap-3 border-t border-black pt-4 border-black sm:grid-cols-3">
          <button
            onClick={onClose}
            className="h-14 rounded-lg border border-black text-lg font-black border-black"
          >
            Cancelar
          </button>
          <button
            onClick={onPrint}
            className="flex h-14 items-center justify-center gap-2 rounded-lg border border-black bg-surface-card text-lg font-black text-[#f8fafc]"
          >
            <Printer className="h-6 w-6" />
            Imprimir
          </button>
          <button
            onClick={onConfirmCharge}
            className="h-14 rounded-lg bg-emerald-400 text-lg font-black text-slate-950"
          >
            Confirmar cobro
          </button>
        </div>
      </div>
    </div>
  );
}
