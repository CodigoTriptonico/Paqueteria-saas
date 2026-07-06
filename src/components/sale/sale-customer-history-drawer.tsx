"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  listCustomerSaleHistoryAction,
  type CustomerSaleHistoryRow,
} from "@/app/actions/sale-customer-history";
import { historyDateLabel, personFullName, type Sender } from "@/components/sale/venta-parts";
import type { ShipmentStatus } from "@/app/actions/shipments";
import { shipmentStatusDisplayLabel } from "@/lib/shipment-display";

type SaleCustomerHistoryDrawerProps = {
  open: boolean;
  sender: Sender | null;
  recipientId?: string;
  recipientName?: string;
  onClose: () => void;
};

export function SaleCustomerHistoryDrawer({
  open,
  sender,
  recipientId,
  recipientName,
  onClose,
}: SaleCustomerHistoryDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<CustomerSaleHistoryRow[]>([]);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const customerId = sender?.id;
    if (!customerId && !recipientId) {
      queueMicrotask(() => setRows([]));
      return;
    }

    if (customerId?.startsWith("local-")) {
      queueMicrotask(() => {
        setRows([]);
        setError("");
      });
      return;
    }

    let cancelled = false;

    queueMicrotask(() => {
      void (async () => {
        setLoading(true);
        setError("");

        const result = await listCustomerSaleHistoryAction({
          customerId: recipientId ? undefined : customerId,
          recipientId,
        });

        if (cancelled) {
          return;
        }

        setLoading(false);

        if (!result.ok) {
          setError(result.error);
          setRows([]);
          return;
        }

        setRows(result.data);
      })();
    });

    return () => {
      cancelled = true;
    };
  }, [open, recipientId, sender?.id]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!mounted || !open) {
    return null;
  }

  const title = recipientId
    ? recipientName || "Destinatario"
    : sender
      ? personFullName(sender)
      : "Cliente";

  const drawer = (
    <div className="fixed inset-0 z-[140]">
      <button
        type="button"
        aria-label="Cerrar historial"
        className="absolute inset-0 bg-black/55"
        onClick={onClose}
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-black bg-[#1a221f] shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-black px-4 py-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase text-slate-500">Historial</p>
            <h2 className="truncate text-xl font-black text-[#f8fafc]">{title}</h2>
            <p className="mt-1 text-sm font-bold text-slate-400">Últimos envíos</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-black bg-surface-card"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="text-sm font-bold text-slate-400">Cargando historial...</p>
          ) : null}
          {error ? (
            <p className="rounded-lg border border-rose-700 bg-rose-950/40 px-3 py-2 text-sm font-bold text-rose-200">
              {error}
            </p>
          ) : null}
          {!loading && !error && !rows.length ? (
            <p className="rounded-xl border border-black bg-surface-inset px-4 py-8 text-center text-sm font-black text-slate-400">
              Sin envíos registrados
            </p>
          ) : null}
          <div className="space-y-2">
            {rows.map((row) => (
              <article
                key={row.id}
                className="rounded-xl border border-black bg-[#2a332f] p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-[#f8fafc]">{row.code}</p>
                    <p className="mt-0.5 text-xs font-bold text-slate-400">
                      {historyDateLabel(row.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-black uppercase ${
                      row.saleKind === "empty_box_deposit"
                        ? "border-emerald-600/40 bg-emerald-400/10 text-emerald-200"
                        : "border-black bg-surface-inset text-slate-300"
                    }`}
                  >
                    {row.saleKind === "empty_box_deposit" ? "Caja vacía" : "Envío"}
                  </span>
                </div>
                <div className="mt-2 grid gap-1 text-xs font-bold text-slate-300">
                  <p>Total: ${row.paid.toFixed(2)}</p>
                  <p>Estado: {shipmentStatusDisplayLabel(row.status as ShipmentStatus)}</p>
                  {row.recipientName ? <p>Destinatario: {row.recipientName}</p> : null}
                  {row.deliveryNotes ? (
                    <p className="text-slate-400">{row.deliveryNotes}</p>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );

  return createPortal(drawer, document.body);
}
