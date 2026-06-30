"use client";

import { Clock, Package } from "lucide-react";
import { personFullName, type Sender } from "@/components/sale/venta-parts";

type SaleRecentSendersProps = {
  senders: Sender[];
  onChoose: (sender: Sender) => void;
  onQuickEmptyBox?: (sender: Sender) => void;
};

export function SaleRecentSenders({
  senders,
  onChoose,
  onQuickEmptyBox,
}: SaleRecentSendersProps) {
  if (!senders.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wide text-slate-500">
        <Clock className="h-3.5 w-3.5" aria-hidden />
        Recientes
      </span>
      {senders.map((sender) => (
        <div
          key={sender.id}
          className="inline-flex max-w-full items-center overflow-hidden rounded-lg border border-black bg-[#2a332f]"
        >
          <button
            type="button"
            onClick={() => onChoose(sender)}
            className="inline-flex max-w-[11rem] items-center px-2.5 py-1.5 text-xs font-black text-slate-200 transition hover:bg-[#314039] hover:text-emerald-100"
            title={personFullName(sender)}
          >
            <span className="truncate">{personFullName(sender)}</span>
          </button>
          {onQuickEmptyBox ? (
            <button
              type="button"
              onClick={() => onQuickEmptyBox(sender)}
              className="inline-flex h-full items-center border-l border-black px-2 py-1.5 text-emerald-300 transition hover:bg-emerald-400/10 hover:text-emerald-200"
              title={`Venta rápida: ${personFullName(sender)}`}
              aria-label={`Venta rápida caja vacía: ${personFullName(sender)}`}
            >
              <Package className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
