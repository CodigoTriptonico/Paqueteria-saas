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
