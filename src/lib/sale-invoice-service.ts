import type { LogisticsTaskType } from "@/lib/logistics-routing";

export function saleInvoiceServiceLabel(operation: LogisticsTaskType) {
  return operation === "deliver_empty_box"
    ? "Servicio de entrega"
    : "Servicio de recoleccion";
}

export function saleInvoiceEtaLabel(value: string | undefined) {
  const eta = value?.trim();
  return eta ? `Entrega est. ${eta}` : "";
}
