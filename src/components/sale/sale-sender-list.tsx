"use client";

import { Plus, Search, UserPlus } from "lucide-react";
import { type MouseEvent, useMemo } from "react";
import { InlineSearchCombobox } from "@/components/inline-search-picker";
import {
  flowPagerClass,
  flowPersonCardGridClass,
  flowPersonListSectionClass,
  flowPersonToolbarClass,
  flowToolbarCreateButtonClass,
} from "@/components/flow-form-styles";
import {
  SalePersonActionButton,
  SalePersonCard,
  salePersonCardEmptyClass,
  SalePersonPager,
  SalePersonStatBadge,
} from "@/components/sale/sale-person-card";
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
    <div className={flowPersonListSectionClass}>
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
          visibleSenders.map((sender) => (
            <SalePersonCard
              key={senderPhoneKey(sender)}
              name={personFullName(sender)}
              phone={senderPhonesLabel(sender)}
              location={[sender.city, sender.state].filter(Boolean).join(", ") || "USA"}
              country="USA"
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
              }}
              onClick={() => onChoose(sender)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onChoose(sender);
                }
              }}
              onContextMenu={(event) => onOpenContextMenu(event, sender)}
              footer={
                <>
                  {sender.recipients.length > 0 ? (
                    <SalePersonStatBadge>{sender.recipients.length} dest.</SalePersonStatBadge>
                  ) : null}
                  {getReferralCount(sender) > 0 ? (
                    <SalePersonStatBadge>{getReferralCount(sender)} ref.</SalePersonStatBadge>
                  ) : null}
                  <SalePersonActionButton
                    title="Agregar referido"
                    variant="ghost"
                    onClick={(event) => {
                      event.stopPropagation();
                      onAddReferral(sender);
                    }}
                  >
                    <Plus className="h-3 w-3" />
                    Ref.
                  </SalePersonActionButton>
                </>
              }
            />
          ))
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
