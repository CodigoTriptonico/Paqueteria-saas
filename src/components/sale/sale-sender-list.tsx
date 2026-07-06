"use client";

import { Search, UserPlus } from "lucide-react";
import { type MouseEvent, useMemo } from "react";
import type { SalePersonCardVariantId } from "@/components/sale/sale-person-card-variants";
import { InlineSearchCombobox } from "@/components/inline-search-picker";
import {
  flowPagerClass,
  flowPersonCardGridClass,
  flowPersonListSectionClass,
  flowPersonToolbarClass,
  flowToolbarCreateButtonClass,
} from "@/components/flow-form-styles";
import { SalePersonCard, salePersonCardEmptyClass, SalePersonPager } from "@/components/sale/sale-person-card";
import { SaleRecentSenders } from "@/components/sale/sale-recent-senders";
import {
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
  recentSenders: Sender[];
  safePage: number;
  pageCount: number;
  onQueryChange: (value: string) => void;
  onPageChange: (updater: (current: number) => number) => void;
  onNewClient: () => void;
  onChoose: (sender: Sender) => void;
  onQuickEmptyBox: (sender: Sender) => void;
  getCardClass: (sender: Sender) => string;
  getReferralCount: (sender: Sender) => number;
  onOpenContextMenu: (event: MouseEvent<HTMLElement>, sender: Sender) => void;
  onIconClick?: (event: MouseEvent<HTMLButtonElement>, sender: Sender) => void;
};

function senderCardHint(sender: Sender, referralCount: number) {
  const parts: string[] = [];

  if (sender.recipients.length > 0) {
    parts.push(`${sender.recipients.length} dest.`);
  } else {
    parts.push("Sin dest.");
  }

  if (referralCount > 0) {
    parts.push(`${referralCount} ref.`);
  }

  return parts.length ? parts.join(" · ") : undefined;
}

export function SaleSenderList({
  query,
  matchingSenders,
  filteredCount,
  visibleSenders,
  recentSenders,
  safePage,
  pageCount,
  onQueryChange,
  onPageChange,
  onNewClient,
  onChoose,
  onQuickEmptyBox,
  getCardClass,
  getReferralCount,
  onOpenContextMenu,
  onIconClick,
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
    <div className={flowPersonListSectionClass}>
      {recentSenders.length ? (
        <SaleRecentSenders
          senders={recentSenders}
          onChoose={onChoose}
          onQuickEmptyBox={onQuickEmptyBox}
        />
      ) : null}
      <div className={flowPersonToolbarClass}>
        <InlineSearchCombobox
          value={query}
          onChange={onQueryChange}
          options={senderSearchOptions}
          placeholder="Buscar remitente o telefono"
          emptyLabel="Sin remitentes"
          ariaLabel="Buscar remitentes"
          leadingIcon={<Search className="h-4 w-4" aria-hidden />}
          className="min-w-0 w-full"
          minWidthClass="w-full min-w-0"
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
        <button type="button" onClick={onNewClient} className={`${flowToolbarCreateButtonClass} justify-self-end`}>
          <UserPlus className="h-4 w-4" />
          <span className="hidden sm:inline">Nuevo remitente</span>
          <span className="sm:hidden">Nuevo</span>
        </button>
      </div>

      <div className={flowPersonCardGridClass}>
        {visibleSenders.length ? (
          visibleSenders.map((sender) => {
            const referralCount = getReferralCount(sender);

            return (
              <SalePersonCard
                key={senderPhoneKey(sender)}
                name={personFullName(sender)}
                phone={senderPhonesLabel(sender)}
                address={{
                  street: sender.street,
                  houseNumber: sender.houseNumber,
                  neighborhood: sender.neighborhood,
                  city: sender.city,
                  state: sender.state,
                  postalCode: sender.postalCode,
                }}
                country="USA"
                cardStyle={sender.cardStyle as SalePersonCardVariantId}
                hint={senderCardHint(sender, referralCount)}
                className={getCardClass(sender)}
                contextProps={{
                  "data-sale-context-key": `sender:${senderPhoneKey(sender)}`,
                  "data-sale-context-type": "remitente",
                  "data-sale-context-title": personFullName(sender),
                  "data-sale-context-first-name": sender.firstName,
                  "data-sale-context-last-name": sender.lastName,
                  "data-sale-context-phones": sender.phones.join("|"),
                  "data-sale-context-street": sender.street,
                  "data-sale-context-house": sender.houseNumber,
                  "data-sale-context-neighborhood": sender.neighborhood,
                  "data-sale-context-city": sender.city,
                  "data-sale-context-state": sender.state,
                  "data-sale-context-postal-code": sender.postalCode,
                  "data-sale-context-country": "USA",
                  "data-sale-context-customer-id": sender.id.startsWith("local-")
                    ? undefined
                    : sender.id,
                }}
                onClick={() => onChoose(sender)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onChoose(sender);
                  }
                }}
                onContextMenu={(event) => onOpenContextMenu(event, sender)}
                onIconClick={
                  onIconClick && !sender.id.startsWith("local-")
                    ? (event) => onIconClick(event, sender)
                    : undefined
                }
                onQuickSale={() => onQuickEmptyBox(sender)}
                quickSaleLabel={`Venta rápida: ${personFullName(sender)}`}
              />
            );
          })
        ) : (
          <div className={salePersonCardEmptyClass}>
            {filteredCount === 0 ? "Sin remitentes" : "Sin resultados"}
          </div>
        )}
      </div>

      <div className={flowPagerClass}>
        <SalePersonPager
          page={safePage}
          pageCount={pageCount}
          onPrev={() => onPageChange((current) => Math.max(0, current - 1))}
          onNext={() => onPageChange((current) => Math.min(pageCount - 1, current + 1))}
          prevLabel="Remitentes anteriores"
          nextLabel="Remitentes siguientes"
        />
      </div>
    </div>
  );
}
