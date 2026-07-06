"use client";

import { type MouseEvent } from "react";
import type { SalePersonCardVariantId } from "@/components/sale/sale-person-card-variants";
import { flowPersonCardGridClass } from "@/components/flow-form-styles";
import { SalePersonAddCard, SalePersonCard, salePersonCardEmptyClass } from "@/components/sale/sale-person-card";
import {
  personFullName,
  type Recipient,
  recipientIdentityKey,
} from "@/components/sale/venta-parts";

type SaleRecipientListProps = {
  filteredCount: number;
  visibleRecipients: Recipient[];
  suggestedRecipientId?: string;
  emptySlots: number;
  safePage: number;
  searchActive?: boolean;
  getCardClass: (recipient: Recipient) => string;
  onChoose: (recipient: Recipient) => void;
  onNewRecipient: () => void;
  onOpenContextMenu: (event: MouseEvent<HTMLElement>, recipient: Recipient) => void;
  onIconClick?: (event: MouseEvent<HTMLButtonElement>, recipient: Recipient) => void;
};

export function SaleRecipientList({
  filteredCount,
  visibleRecipients,
  suggestedRecipientId,
  emptySlots,
  safePage,
  searchActive = false,
  getCardClass,
  onChoose,
  onNewRecipient,
  onOpenContextMenu,
  onIconClick,
}: SaleRecipientListProps) {
  const showSearchEmpty = searchActive && filteredCount === 0;
  const showNoRecipients = !searchActive && filteredCount === 0;

  return (
    <div className={flowPersonCardGridClass}>
      {visibleRecipients.map((recipient) => {
        const isSuggested =
          Boolean(suggestedRecipientId) && recipient.id === suggestedRecipientId;

        return (
          <SalePersonCard
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
            contextProps={{
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
            }}
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
        <>
          <div className={salePersonCardEmptyClass}>
            Este remitente no tiene destinatarios registrados
          </div>
          <SalePersonAddCard label="Nuevo destinatario" onClick={onNewRecipient} />
        </>
      ) : (
        Array.from({ length: emptySlots }).map((_, index) => (
          <SalePersonAddCard
            key={`empty-recipient-${safePage}-${index}`}
            label="Nuevo destinatario"
            onClick={onNewRecipient}
          />
        ))
      )}
    </div>
  );
}
