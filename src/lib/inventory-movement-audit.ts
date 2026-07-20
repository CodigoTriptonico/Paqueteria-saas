export type InventoryMovementReasonCode =
  | "unspecified"
  | "manual_entry"
  | "manual_exit"
  | "physical_count"
  | "sale_fulfillment"
  | "warehouse_transfer_out"
  | "warehouse_transfer_in"
  | "warehouse_transfer_cancel"
  | "assignment_issue"
  | "assignment_return"
  | "assignment_consume"
  | "assignment_damage"
  | "assignment_loss"
  | "agency_delivery"
  | "correction_reversal"
  | "other";

export type InventoryMovementLocationType =
  | "warehouse"
  | "assignee"
  | "truck"
  | "agency"
  | "external"
  | "shipment"
  | "unknown";

export type InventoryMovementReferenceType =
  | "shipment"
  | "assignment"
  | "warehouse_transfer"
  | "sale_reservation"
  | "agency_visit"
  | "physical_count"
  | "manual";

export type InventoryMovementLocation = {
  type: InventoryMovementLocationType | null;
  id: string | null;
  label: string;
};

export type InventoryMovementEvidence = {
  photos?: string[];
  note?: string;
};

export const inventoryMovementReasonLabel: Record<InventoryMovementReasonCode, string> = {
  unspecified: "Sin clasificar",
  manual_entry: "Entrada manual",
  manual_exit: "Salida manual",
  physical_count: "Conteo físico",
  sale_fulfillment: "Venta / envío",
  warehouse_transfer_out: "Transferencia (salida)",
  warehouse_transfer_in: "Transferencia (entrada)",
  warehouse_transfer_cancel: "Transferencia cancelada",
  assignment_issue: "Asignación a empleado",
  assignment_return: "Devolución de asignación",
  assignment_consume: "Consumo interno",
  assignment_damage: "Daño",
  assignment_loss: "Pérdida",
  agency_delivery: "Entrega a agencia",
  correction_reversal: "Reverso",
  other: "Otro",
};

export const inventoryMovementReferenceLabel: Record<InventoryMovementReferenceType, string> = {
  shipment: "Envío",
  assignment: "Asignación",
  warehouse_transfer: "Transferencia",
  sale_reservation: "Reserva de venta",
  agency_visit: "Visita a agencia",
  physical_count: "Conteo físico",
  manual: "Manual",
};

export const manualMovementReasonOptions: Array<{
  value: InventoryMovementReasonCode;
  label: string;
}> = [
  { value: "manual_entry", label: "Entrada manual" },
  { value: "manual_exit", label: "Salida manual" },
  { value: "physical_count", label: "Conteo físico" },
  { value: "other", label: "Otro" },
];

export function defaultReasonCodeForMovementType(
  type: "entrada" | "salida" | "ajuste",
): InventoryMovementReasonCode {
  if (type === "entrada") {
    return "manual_entry";
  }

  if (type === "salida") {
    return "manual_exit";
  }

  return "physical_count";
}

export function movementReasonRequiresDetail(reasonCode: InventoryMovementReasonCode) {
  return reasonCode === "other" || reasonCode === "physical_count";
}

export function formatInventoryMovementTrail(input: {
  fromLabel?: string;
  toLabel?: string;
}) {
  const fromLabel = input.fromLabel?.trim() || "";
  const toLabel = input.toLabel?.trim() || "";

  if (fromLabel && toLabel) {
    return `${fromLabel} → ${toLabel}`;
  }

  if (toLabel) {
    return `→ ${toLabel}`;
  }

  if (fromLabel) {
    return `${fromLabel} →`;
  }

  return "";
}

export function readInventoryMovementEvidencePhotos(
  evidence: InventoryMovementEvidence | Record<string, unknown> | null | undefined,
) {
  if (!evidence || typeof evidence !== "object") {
    return [] as string[];
  }

  const photos = (evidence as InventoryMovementEvidence).photos;

  if (!Array.isArray(photos)) {
    return [] as string[];
  }

  return photos.filter((url): url is string => typeof url === "string" && url.trim().length > 0);
}

export function emptyInventoryMovementAuditFields(): Pick<
  import("@/lib/inventory-types").InventoryMovement,
  | "reasonCode"
  | "fromLocationType"
  | "fromLocationId"
  | "fromLocationLabel"
  | "toLocationType"
  | "toLocationId"
  | "toLocationLabel"
  | "referenceType"
  | "referenceId"
  | "evidence"
  | "reversalOfMovementId"
> {
  return {
    reasonCode: "unspecified",
    fromLocationType: null,
    fromLocationId: null,
    fromLocationLabel: "",
    toLocationType: null,
    toLocationId: null,
    toLocationLabel: "",
    referenceType: null,
    referenceId: null,
    evidence: {},
    reversalOfMovementId: null,
  };
}

export function formatInventoryMovementReference(input: {
  referenceType?: InventoryMovementReferenceType | string | null;
  referenceId?: string | null;
  referenceLabel?: string | null;
}) {
  const type = input.referenceType;

  if (!type) {
    return "";
  }

  const typeLabel =
    inventoryMovementReferenceLabel[type as InventoryMovementReferenceType] || type;

  if (input.referenceLabel?.trim()) {
    return `${typeLabel}: ${input.referenceLabel.trim()}`;
  }

  if (input.referenceId) {
    return `${typeLabel}`;
  }

  return typeLabel;
}
