export type PackageInvoiceLifecycleState =
  | "created"
  | "paid"
  | "in_warehouse"
  | "in_transit"
  | "delivered";

export type PackageInvoiceLifecycleEvent = {
  state: PackageInvoiceLifecycleState;
  occurredAt: string;
  changedByName: string;
};

export const packageInvoiceLifecycleLabel: Record<PackageInvoiceLifecycleState, string> = {
  created: "Creada",
  paid: "Pagada",
  in_warehouse: "En bodega",
  in_transit: "En tránsito",
  delivered: "Entregada",
};

export function packageInvoiceStateSummary(input: {
  paymentStatus: "pending" | "paid";
  fulfillmentStatus: "created" | "in_warehouse" | "in_transit" | "delivered";
}) {
  if (input.fulfillmentStatus !== "created") {
    return packageInvoiceLifecycleLabel[input.fulfillmentStatus];
  }

  return input.paymentStatus === "paid" ? packageInvoiceLifecycleLabel.paid : packageInvoiceLifecycleLabel.created;
}
