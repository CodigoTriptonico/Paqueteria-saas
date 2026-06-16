"use client";

import { MapPin, Phone, Plus, User } from "lucide-react";
import { type MouseEvent } from "react";
import {
  Flag,
  personFullName,
  type Recipient,
  recipientIdentityKey,
} from "@/components/sale/venta-parts";

type SaleRecipientListProps = {
  filteredCount: number;
  visibleRecipients: Recipient[];
  emptySlots: number;
  safePage: number;
  getCardClass: (recipient: Recipient) => string;
  onChoose: (recipient: Recipient) => void;
  onNewRecipient: () => void;
  onOpenContextMenu: (event: MouseEvent<HTMLElement>, recipient: Recipient) => void;
};

export function SaleRecipientList({
  filteredCount,
  visibleRecipients,
  emptySlots,
  safePage,
  getCardClass,
  onChoose,
  onNewRecipient,
  onOpenContextMenu,
}: SaleRecipientListProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {filteredCount ? (
        <>
          {visibleRecipients.map((recipient) => (
            <div
              key={recipientIdentityKey(recipient)}
              role="button"
              tabIndex={0}
              data-sale-context-key={`recipient:${recipientIdentityKey(recipient)}`}
              data-sale-context-type="destinatario"
              data-sale-context-title={personFullName(recipient)}
              data-sale-context-first-name={recipient.firstName}
              data-sale-context-last-name={recipient.lastName}
              data-sale-context-phones={recipient.phone}
              data-sale-context-street={recipient.street}
              data-sale-context-house={recipient.houseNumber}
              data-sale-context-neighborhood={recipient.neighborhood}
              data-sale-context-city={recipient.city}
              data-sale-context-state={recipient.state}
              data-sale-context-postal-code={recipient.postalCode}
              data-sale-context-country={recipient.country}
              onClick={() => onChoose(recipient)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onChoose(recipient);
                }
              }}
              onContextMenu={(event) => onOpenContextMenu(event, recipient)}
              style={{ width: "min(100%, 34rem)" }}
              className={`group flex min-h-[8.25rem] flex-col items-center justify-center rounded-xl border border-black bg-[#3f4b46] p-3 text-center shadow-[0_8px_18px_rgba(0,0,0,0.26)] transition hover:-translate-y-0.5 hover:bg-[#46544e] ${getCardClass(recipient)}`}
            >
              <span className="flex min-w-0 flex-col items-center">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-400 text-slate-950 shadow-[0_8px_14px_rgba(16,185,129,0.2)]">
                  <User className="h-5 w-5" />
                </span>
                <span className="mt-1.5 min-w-0">
                  <span className="block truncate text-xl font-black leading-tight text-[#f8fafc]">
                    {personFullName(recipient)}
                  </span>
                  <span className="mt-1 flex min-w-0 justify-center gap-1.5 text-sm font-bold text-slate-300">
                    <Phone className="h-4 w-4 shrink-0" />
                    <span className="truncate">{recipient.phone}</span>
                  </span>
                </span>
              </span>
              <span className="my-1.5 flex w-full min-w-0 justify-center gap-2 border-y border-white/10 py-1">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                <span className="min-w-0">
                  <span className="block truncate text-base font-black text-[#f8fafc]">
                    {[recipient.street, recipient.houseNumber].filter(Boolean).join(" ")}
                  </span>
                  <span className="mt-1 block truncate text-sm font-bold text-slate-400">
                    {[recipient.city, recipient.state, recipient.postalCode].filter(Boolean).join(", ")}
                  </span>
                </span>
              </span>
              <span className="flex items-center justify-center gap-2">
                <span className="inline-flex h-8 items-center gap-2 rounded-md border border-black/70 bg-[#202926] px-2.5 text-xs font-black text-[#f8fafc]">
                  <Flag country={recipient.country} />
                  {recipient.country}
                </span>
              </span>
            </div>
          ))}
          {Array.from({ length: emptySlots }).map((_, index) => (
            <button
              key={`empty-recipient-${safePage}-${index}`}
              onClick={onNewRecipient}
              style={{ width: "min(100%, 34rem)" }}
              className="flex min-h-[8.25rem] flex-col items-center justify-center gap-2 rounded-xl border border-black bg-[#3f4b46] text-slate-950 shadow-[0_8px_18px_rgba(0,0,0,0.26)] transition hover:-translate-y-0.5 hover:bg-[#46544e]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-400">
                <Plus className="h-6 w-6" />
              </span>
              <span className="rounded-lg bg-emerald-400 px-3 py-2 text-sm font-black">
                Nuevo destinatario
              </span>
            </button>
          ))}
        </>
      ) : (
        <div className="col-span-full rounded-xl border border-white/10 bg-[#3f4b46] p-4 text-center text-xl font-black">
          Sin destinatarios
        </div>
      )}
    </div>
  );
}
