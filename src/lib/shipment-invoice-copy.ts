import { formatMoneyValue } from "@/lib/logistics-fees";

export function collectShipmentInvoiceCopy(balanceDue: number) {
  const amount = formatMoneyValue(balanceDue);

  return {
    actionLabel: "Cobrar",
    actionTitle: "Cobrar pendiente",
    dialogTitle: "¿Cobrar pendiente?",
    pendingLineLabel: "Vas a cobrar",
    confirmLabel: `Cobrar ${amount}`,
    confirmingLabel: "Cobrando...",
  };
}

export function collectedShipmentInvoiceMessage(code: string) {
  return `Invoice ${code} cobrado`;
}

export function collectedShipmentInvoiceLabel(code: string) {
  return `Factura ${code} · queda como pagada`;
}
