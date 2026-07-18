export type PhysicalPackageStatus =
  | "awaiting_full_box"
  | "in_truck"
  | "pending_intake"
  | "warehouse_intake"
  | "in_warehouse"
  | "on_pallet"
  | "handed_to_carrier";

export type PackageContentLine = {
  description: string;
  quantity: number;
  declaredValue: number;
};

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

export type PhysicalPackage = {
  id: string;
  shipmentId: string;
  shipmentCode: string;
  customerName: string;
  recipientName: string;
  code: string;
  country: string;
  status: PhysicalPackageStatus;
  collectionWeightKg: number | null;
  collectionSource: "driver" | "office" | null;
  collectionRecordedAt: string | null;
  intakeWeightKg: number | null;
  intakeRecordedAt: string | null;
  weightDifferenceKg: number | null;
  weightDifferenceNote: string;
  weightDifferenceReviewedAt: string | null;
  contents: PackageContentLine[];
  contentsValidatedAt: string | null;
  providerName: string;
  providerService: string;
  providerConfirmationNumber: string;
  providerTrackingNumber: string;
  providerTrackingUrl: string;
  palletId: string | null;
  palletCode: string | null;
  truckRouteId: string | null;
  truckTaskId: string | null;
  truckArrivedAt: string | null;
  truckUnloadedAt: string | null;
  warehousePlacedAt: string | null;
  palletizedAt: string | null;
  invoiceCode: string;
  invoiceMarkedAt: string | null;
  invoiceDeliveryEvidenceUrl: string;
  invoicePickupConfirmedAt: string | null;
  invoicePickupEvidenceUrl: string;
  invoiceIncidentAt: string | null;
  invoiceIncidentReason: string;
  invoicePaymentStatus: "pending" | "paid";
  invoiceFulfillmentStatus: "created" | "in_warehouse" | "in_transit" | "delivered";
  invoiceLifecycle: PackageInvoiceLifecycleEvent[];
};

export const physicalPackageStatusLabel: Record<PhysicalPackageStatus, string> = {
  awaiting_full_box: "Esperando caja llena",
  in_truck: "En camión",
  pending_intake: "Pendiente de ingreso",
  warehouse_intake: "Ingreso a bodega",
  in_warehouse: "En bodega",
  on_pallet: "En paleta",
  handed_to_carrier: "Entregada a proveedor",
};

export function parsePackageContents(value: unknown): PackageContentLine[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((line) => {
      const row =
        line && typeof line === "object" ? (line as Record<string, unknown>) : {};
      return {
        description: String(row.description || "").trim(),
        quantity: Math.max(0, Number(row.quantity) || 0),
        declaredValue: Math.max(0, Number(row.declaredValue) || 0),
      };
    })
    .filter((line) => line.description && line.quantity > 0);
}

export function validatePackageContents(value: unknown) {
  const lines = parsePackageContents(value);
  if (!lines.length) {
    return { ok: false as const, error: "Agrega al menos un artículo con cantidad." };
  }
  if (lines.some((line) => line.declaredValue < 0)) {
    return { ok: false as const, error: "El valor declarado no puede ser negativo." };
  }
  return { ok: true as const, data: lines };
}

export function physicalPackageCode(invoiceCode: string, index: number) {
  return `${invoiceCode.trim()}-${String(index + 1).padStart(2, "0")}`;
}

export function physicalPackageCountFromPlan(plan: Record<string, unknown> | null | undefined) {
  const safePlan = plan && typeof plan === "object" && !Array.isArray(plan) ? plan : {};
  const boxLines = Array.isArray(safePlan.boxLines) ? safePlan.boxLines : [];
  const lineCount = boxLines.reduce((total, entry) => {
    const line = entry && typeof entry === "object" && !Array.isArray(entry)
      ? (entry as Record<string, unknown>)
      : null;
    const label = String(line?.label || "").trim();
    return label ? total + Math.max(Number(line?.quantity) || 1, 1) : total;
  }, 0);

  if (lineCount > 0) return lineCount;

  const box = safePlan.box && typeof safePlan.box === "object" && !Array.isArray(safePlan.box)
    ? (safePlan.box as Record<string, unknown>)
    : null;
  return String(box?.label || box?.name || "").trim()
    ? Math.max(Number(safePlan.boxCount) || 1, 1)
    : 1;
}

export function physicalPackageCodesForShipment(
  invoiceCode: string,
  logisticsPlan: Record<string, unknown> | null | undefined,
) {
  return Array.from(
    { length: physicalPackageCountFromPlan(logisticsPlan) },
    (_, index) => physicalPackageCode(invoiceCode, index),
  );
}
