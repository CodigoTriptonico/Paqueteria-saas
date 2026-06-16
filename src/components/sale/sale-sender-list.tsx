"use client";

import { ChevronLeft, ChevronRight, MapPin, Phone, Plus, Search, User, UserPlus } from "lucide-react";
import { type MouseEvent, useMemo } from "react";
import { InlineSearchCombobox } from "@/components/inline-search-picker";
import {
  Flag,
  personFullName,
  type Sender,
  senderPhoneKey,
  senderPhonesLabel,
} from "@/components/sale/venta-parts";

type SaleSenderListProps = {
  query: string;
  matchingSenders: Sender[];
  filteredCount: number;
  visibleSenders: Sender[];
  safePage: number;
  pageCount: number;
  onQueryChange: (value: string) => void;
  onPageChange: (updater: (current: number) => number) => void;
  onNewClient: () => void;
  onAddReferral: (sender: Sender) => void;
  onChoose: (sender: Sender) => void;
  getCardClass: (sender: Sender) => string;
  getReferralCount: (sender: Sender) => number;
  onOpenContextMenu: (event: MouseEvent<HTMLElement>, sender: Sender) => void;
};

export function SaleSenderList({
  query,
  matchingSenders,
  filteredCount,
  visibleSenders,
  safePage,
  pageCount,
  onQueryChange,
  onPageChange,
  onNewClient,
  onAddReferral,
  onChoose,
  getCardClass,
  getReferralCount,
  onOpenContextMenu,
}: SaleSenderListProps) {
  const senderSearchOptions = useMemo(
    () =>
      matchingSenders.map((sender) => ({
        value: senderPhoneKey(sender),
        label: personFullName(sender),
        searchText: [
          personFullName(sender),
          sender.firstName,
          sender.lastName,
          ...sender.phones,
          sender.street,
          sender.city,
        ]
          .filter(Boolean)
          .join(" "),
      })),
    [matchingSenders],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <InlineSearchCombobox
          value={query}
          onChange={onQueryChange}
          options={senderSearchOptions}
          placeholder="Buscar remitente o telefono"
          emptyLabel="Sin remitentes"
          ariaLabel="Buscar remitentes"
          leadingIcon={<Search className="h-4 w-4" aria-hidden />}
          className="min-w-0 flex-1 lg:max-w-md"
          minWidthClass="w-full min-w-[18rem]"
          onSelectOption={(option) => {
            const sender = matchingSenders.find(
              (entry) => senderPhoneKey(entry) === option.value,
            );
            if (sender) {
              onQueryChange(personFullName(sender));
              onChoose(sender);
            }
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          {filteredCount ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onPageChange((current) => Math.max(0, current - 1))}
                disabled={safePage === 0}
                className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-400 text-slate-950 disabled:cursor-not-allowed disabled:bg-[#1a211e] disabled:text-slate-600"
                aria-label="Remitentes anteriores"
                title="Anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="min-w-[3.25rem] px-2 py-1 text-center text-xs font-black text-[#f8fafc]">
                {safePage + 1}/{pageCount}
              </span>
              <button
                type="button"
                onClick={() => onPageChange((current) => Math.min(pageCount - 1, current + 1))}
                disabled={safePage >= pageCount - 1}
                className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-400 text-slate-950 disabled:cursor-not-allowed disabled:bg-[#1a211e] disabled:text-slate-600"
                aria-label="Remitentes siguientes"
                title="Siguiente"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          ) : null}
          <button
            onClick={onNewClient}
            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-3 text-sm font-black text-slate-950"
          >
            <UserPlus className="h-6 w-6" />
            Nuevo remitente
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
          {visibleSenders.length ? (
            visibleSenders.map((sender) => (
              <div
                key={senderPhoneKey(sender)}
                role="button"
                tabIndex={0}
                data-sale-context-key={`sender:${senderPhoneKey(sender)}`}
                data-sale-context-type="remitente"
                data-sale-context-title={personFullName(sender)}
                data-sale-context-first-name={sender.firstName}
                data-sale-context-last-name={sender.lastName}
                data-sale-context-phones={sender.phones.join("|")}
                data-sale-context-street={sender.street}
                data-sale-context-house={sender.houseNumber}
                data-sale-context-neighborhood={sender.neighborhood}
                data-sale-context-city={sender.city}
                data-sale-context-state={sender.state}
                data-sale-context-postal-code={sender.postalCode}
                data-sale-context-country="USA"
                onClick={() => onChoose(sender)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onChoose(sender);
                  }
                }}
                onContextMenu={(event) => onOpenContextMenu(event, sender)}
                style={{ width: "min(100%, 34rem)" }}
                className={`group relative flex min-h-[8.25rem] flex-col items-center justify-center rounded-xl border border-black bg-[#3f4b46] p-3 text-center shadow-[0_8px_18px_rgba(0,0,0,0.26)] transition hover:-translate-y-0.5 hover:bg-[#46544e] ${getCardClass(sender)}`}
              >
                <div className="flex min-w-0 flex-col items-center">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-400 text-slate-950 shadow-[0_8px_14px_rgba(16,185,129,0.2)]">
                    <User className="h-5 w-5" />
                  </span>
                  <span className="mt-1.5 min-w-0">
                    <p className="line-clamp-1 text-xl font-black leading-tight text-[#f8fafc]">
                      {personFullName(sender)}
                    </p>
                    <p className="mt-1 flex min-w-0 justify-center gap-1.5 text-sm font-bold text-slate-300">
                      <Phone className="h-4 w-4 shrink-0" />
                      <span className="truncate">{senderPhonesLabel(sender)}</span>
                    </p>
                    {sender.email ? (
                      <p className="truncate text-sm font-bold text-slate-500">{sender.email}</p>
                    ) : null}
                  </span>
                </div>

                <p className="my-1.5 flex w-full min-w-0 justify-center gap-2 border-y border-white/10 py-1">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <span className="min-w-0">
                    <span className="block truncate text-base font-black text-[#f8fafc]">
                      {[sender.street, sender.houseNumber].filter(Boolean).join(" ")}
                    </span>
                    <span className="mt-1 block truncate text-sm font-bold text-slate-400">
                      {[sender.city, sender.state, sender.postalCode].filter(Boolean).join(", ")}
                    </span>
                  </span>
                </p>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="inline-flex h-8 items-center gap-2 rounded-md border border-black/70 bg-[#202926] px-2.5 text-xs font-black text-[#f8fafc]">
                    <Flag country="USA" />
                    USA
                  </span>
                  <span className="inline-flex h-8 items-center rounded-md border border-black/70 bg-emerald-400/12 px-2.5 text-xs font-black text-emerald-200">
                    {sender.recipients.length} dest.
                  </span>
                  <span className="inline-flex h-8 items-center rounded-md border border-black/70 bg-emerald-400/12 px-2.5 text-xs font-black text-emerald-200">
                    {getReferralCount(sender)} ref.
                  </span>
                  <button
                    type="button"
                    title="Agregar referido"
                    aria-label="Agregar referido"
                    onClick={(event) => {
                      event.stopPropagation();
                      onAddReferral(sender);
                    }}
                    className="inline-flex h-8 items-center gap-1 rounded-md bg-emerald-400 px-2.5 text-xs font-black text-slate-950 transition hover:bg-emerald-300"
                  >
                    <Plus className="h-4 w-4" />
                    Ref.
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full flex min-h-24 items-center justify-center rounded-xl border border-white/10 bg-[#3f4b46] p-4 text-center text-xl font-black">
              Sin remitentes
            </div>
          )}
      </div>
    </div>
  );
}
