"use client";

import { type MouseEvent } from "react";
import type { SalePersonCardVariantId } from "@/components/sale/sale-person-card-variants";
import {
  flowPersonCardGridClass,
  flowPersonRowListFrameClass,
  flowPersonRowListInnerClass,
  flowPersonRowListSlotClass,
} from "@/components/flow-form-styles";
import {
  SalePersonCard,
  SalePersonRow,
  salePersonCardEmptyClass,
  salePersonRowEmptyClass,
} from "@/components/sale/sale-person-card";
import {
  personFullName,
  type Recipient,
  recipientIdentityKey,
} from "@/components/sale/venta-parts";
import type { ViewLayout } from "@/lib/view-layout";

type SaleRecipientListProps = {
  recipients: Recipient[];
  viewLayout: ViewLayout;
  suggestedRecipientId?: string;
  searchActive?: boolean;
  getCardClass: (recipient: Recipient) => string;
  onChoose: (recipient: Recipient) => void;
  onOpenContextMenu: (event: MouseEvent<HTMLElement>, recipient: Recipient) => void;
  onIconClick?: (event: MouseEvent<HTMLButtonElement>, recipient: Recipient) => void;
};

function recipientContextProps(recipient: Recipient) {
  return {
    "data-sale-context-key": `recipient:${recipientIdentityKey(recipient)}`,
    "data-sale-context-type": "destinatario",
    "data-sale-context-title": personFullName(recipient),
    "data-sale-context-first-name": recipient.firstName,
    "data-sale-context-last-name": recipient.lastName,
    "data-sale-context-phones": recipient.phone,
    "data-sale-context-street": recipient.street,
    "data-sale-context-house": recipient.houseNumber,
    "data-sale-context-neighborhood": recipient.neighborhood,
    "data-sale-context-city": recipient.city,
    "data-sale-context-state": recipient.state,
    "data-sale-context-postal-code": recipient.postalCode,
    "data-sale-context-country": recipient.country,
    "data-sale-context-recipient-id": recipient.id.startsWith("local-r-")
      ? undefined
      : recipient.id,
  };
}

export function SaleRecipientList({
  recipients,
  viewLayout,
  suggestedRecipientId,
  searchActive = false,
  getCardClass,
  onChoose,
  onOpenContextMenu,
  onIconClick,
}: SaleRecipientListProps) {
  const showSearchEmpty = searchActive && recipients.length === 0;
  const showNoRecipients = !searchActive && recipients.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {viewLayout === "rows" ? (
        <div className={flowPersonRowListSlotClass}>
          <div className={flowPersonRowListFrameClass}>
            {recipients.length ? (
              <div className={flowPersonRowListInnerClass}>
                {recipients.map((recipient) => {
                  const isSuggested =
                    Boolean(suggestedRecipientId) && recipient.id === suggestedRecipientId;

                  return (
                    <SalePersonRow
                      key={recipientIdentityKey(recipient)}
                      name={personFullName(recipient)}
                      phone={recipient.phone}
                      address={{
                        street: recipient.street,
                        houseNumber: recipient.houseNumber,
                        neighborhood: recipient.neighborhood,
                        city: recipient.city,
                        state: recipient.state,
                        postalCode: recipient.postalCode,
                      }}
                      country={recipient.country}
                      cardStyle={recipient.cardStyle as SalePersonCardVariantId}
                      hint={isSuggested ? "Último envío" : undefined}
                      hintHighlighted={isSuggested}
                      className={getCardClass(recipient)}
                      contextProps={recipientContextProps(recipient)}
                      onClick={() => onChoose(recipient)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onChoose(recipient);
                        }
                      }}
                      onContextMenu={(event) => onOpenContextMenu(event, recipient)}
                      onIconClick={
                        onIconClick && !recipient.id.startsWith("local-r-")
                          ? (event) => onIconClick(event, recipient)
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            ) : showSearchEmpty ? (
              <div className={`${salePersonRowEmptyClass} flex min-h-0 flex-1 items-center justify-center`}>
                Sin resultados para esa búsqueda
              </div>
            ) : showNoRecipients ? (
              <div className={flowPersonRowListInnerClass}>
                <div className={`${salePersonRowEmptyClass} flex min-h-[8rem] items-center justify-center`}>
                  Este remitente no tiene destinatarios registrados
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className={flowPersonRowListSlotClass}>
          <div className={flowPersonCardGridClass}>
            {recipients.map((recipient) => {
              const isSuggested =
                Boolean(suggestedRecipientId) && recipient.id === suggestedRecipientId;

              return (
                <SalePersonCard
                  key={recipientIdentityKey(recipient)}
                  pageSurfaceTint
                  name={personFullName(recipient)}
                  phone={recipient.phone}
                  address={{
                    street: recipient.street,
                    houseNumber: recipient.houseNumber,
                    neighborhood: recipient.neighborhood,
                    city: recipient.city,
                    state: recipient.state,
                    postalCode: recipient.postalCode,
                  }}
                  country={recipient.country}
                  cardStyle={recipient.cardStyle as SalePersonCardVariantId}
                  hint={isSuggested ? "Último envío" : undefined}
                  hintHighlighted={isSuggested}
                  className={getCardClass(recipient)}
                  contextProps={recipientContextProps(recipient)}
                  onClick={() => onChoose(recipient)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onChoose(recipient);
                    }
                  }}
                  onContextMenu={(event) => onOpenContextMenu(event, recipient)}
                  onIconClick={
                    onIconClick && !recipient.id.startsWith("local-r-")
                      ? (event) => onIconClick(event, recipient)
                      : undefined
                  }
                />
              );
            })}

            {showSearchEmpty ? (
              <div className={salePersonCardEmptyClass}>Sin resultados para esa búsqueda</div>
            ) : null}

            {showNoRecipients ? (
              <div className={salePersonCardEmptyClass}>
                Este remitente no tiene destinatarios registrados
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
