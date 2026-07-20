"use client";

import { Search, UserPlus } from "lucide-react";
import { type MouseEvent, useMemo } from "react";
import type { SalePersonCardVariantId } from "@/components/sale/sale-person-card-variants";
import { InlineSearchCombobox } from "@/components/inline-search-picker";
import {
  flowPersonCardGridClass,
  flowPersonListSectionClass,
  flowPersonRowListFrameClass,
  flowPersonRowListInnerClass,
  flowPersonRowListSlotClass,
  flowPersonToolbarSearchShellClass,
} from "@/components/flow-form-styles";
import {
  SalePersonCard,
  SalePersonRow,
  salePersonCardEmptyClass,
  salePersonRowEmptyClass,
} from "@/components/sale/sale-person-card";
import { formatSalePersonListCount } from "@/lib/sale-person-list-count";
import { SalePersonListToolbar } from "@/components/sale/sale-person-list-toolbar";
import { SaleRecentSenders } from "@/components/sale/sale-recent-senders";
import {
  personFullName,
  type Sender,
  senderPhoneKey,
  senderPhonesLabel,
} from "@/components/sale/venta-parts";
import type { ViewLayout } from "@/lib/view-layout";
import { ONBOARDING_TARGETS } from "@/lib/onboarding/coach-targets";

type SaleSenderListProps = {
  query: string;
  matchingSenders: Sender[];
  senders: Sender[];
  totalCount?: number;
  searchActive?: boolean;
  recentSenders: Sender[];
  viewLayout: ViewLayout;
  onQueryChange: (value: string) => void;
  onNewClient: () => void;
  onChoose: (sender: Sender) => void;
  onQuickEmptyBox: (sender: Sender) => void;
  getCardClass: (sender: Sender) => string;
  getReferralCount: (sender: Sender) => number;
  onOpenContextMenu: (event: MouseEvent<HTMLElement>, sender: Sender) => void;
  onIconClick?: (event: MouseEvent<HTMLButtonElement>, sender: Sender) => void;
};

function senderPersonHint(sender: Sender, referralCount: number) {
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

function senderContextProps(sender: Sender) {
  return {
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
    "data-sale-context-address-reference": sender.addressReference,
    "data-sale-context-country": "USA",
    "data-sale-context-customer-id": sender.id.startsWith("local-") ? undefined : sender.id,
  };
}

export function SaleSenderList({
  query,
  matchingSenders,
  senders,
  totalCount,
  searchActive = false,
  recentSenders,
  viewLayout,
  onQueryChange,
  onNewClient,
  onChoose,
  onQuickEmptyBox,
  getCardClass,
  getReferralCount,
  onOpenContextMenu,
  onIconClick,
}: SaleSenderListProps) {
  const countLabel = formatSalePersonListCount(senders.length, {
    kind: "remitente",
    totalCount,
    filtered: searchActive,
  });

  const senderSearchOptions = useMemo(
    () =>
      matchingSenders.map((sender) => ({
        value: senderPhoneKey(sender),
        label: personFullName(sender),
        searchText: [
          personFullName(sender),
          sender.firstName,
          sender.lastName,
          ...sender.emails,
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
      <SalePersonListToolbar
        onCreate={onNewClient}
        createIcon={<UserPlus className="h-4 w-4" />}
        createLabel="Nuevo remitente"
        createShortLabel="Nuevo"
        createOnboardingTarget={ONBOARDING_TARGETS.VENTA_NEW_SENDER}
        countLabel={countLabel}
        recents={
          recentSenders.length ? (
            <SaleRecentSenders
              senders={recentSenders}
              onChoose={onChoose}
              onQuickEmptyBox={onQuickEmptyBox}
            />
          ) : undefined
        }
        search={
          <InlineSearchCombobox
            value={query}
            onChange={onQueryChange}
            options={senderSearchOptions}
            placeholder="Buscar remitente o telefono"
            emptyLabel="Sin remitentes"
            ariaLabel="Buscar remitentes"
            leadingIcon={<Search className="h-4 w-4" aria-hidden />}
            className="w-full"
            minWidthClass="min-w-0 w-full"
            persistent
            shellClassName={flowPersonToolbarSearchShellClass}
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
        }
      />

      {viewLayout === "rows" ? (
        <div className={flowPersonRowListSlotClass}>
          <div className={flowPersonRowListFrameClass}>
            {senders.length ? (
              <div className={flowPersonRowListInnerClass}>
                {senders.map((sender) => {
                  const referralCount = getReferralCount(sender);

                  return (
                    <SalePersonRow
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
                      hint={senderPersonHint(sender, referralCount)}
                      className={getCardClass(sender)}
                      contextProps={senderContextProps(sender)}
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
                })}
              </div>
            ) : (
              <div className={`${salePersonRowEmptyClass} flex min-h-0 flex-1 items-center justify-center`}>
                {senders.length === 0 ? "Sin remitentes" : "Sin resultados"}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className={flowPersonRowListSlotClass}>
          <div className={flowPersonCardGridClass}>
            {senders.length ? (
              senders.map((sender) => {
                const referralCount = getReferralCount(sender);

                return (
                  <SalePersonCard
                    key={senderPhoneKey(sender)}
                    pageSurfaceTint
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
                    hint={senderPersonHint(sender, referralCount)}
                    className={getCardClass(sender)}
                    contextProps={senderContextProps(sender)}
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
                {senders.length === 0 ? "Sin remitentes" : "Sin resultados"}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
