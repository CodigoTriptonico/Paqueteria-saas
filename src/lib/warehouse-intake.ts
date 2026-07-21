export const warehouseIntakeConditions = [
  "correct",
  "opened",
  "dented",
  "wet",
  "broken",
  "poorly_sealed",
  "unreadable_label",
  "exposed_contents",
  "unidentified",
] as const;

export type WarehouseIntakeCondition = (typeof warehouseIntakeConditions)[number];

export const warehouseIntakeConditionLabel: Record<WarehouseIntakeCondition, string> = {
  correct: "Correcta",
  opened: "Abierta",
  dented: "Golpeada",
  wet: "Mojada",
  broken: "Rota",
  poorly_sealed: "Mal sellada",
  unreadable_label: "Etiqueta ilegible",
  exposed_contents: "Contenido expuesto",
  unidentified: "No identificada",
};

export type WarehouseIntakeStatus =
  | "unloading"
  | "in_review"
  | "completed"
  | "completed_with_exceptions"
  | "cancelled";

export type WarehouseIntakeKind = "truck_manifest" | "found_in_warehouse";

export type WarehouseIntakeSummary = {
  expected: number;
  received: number;
  missing: number;
  unexpected: number;
  damaged: number;
  unidentified: number;
  weightDifferences: number;
  quarantine: number;
};

export type WarehouseIntakeItem = {
  id: string;
  packageId: string | null;
  scannedCode: string;
  matchStatus: "expected" | "unexpected" | "unidentified";
  condition: WarehouseIntakeCondition;
  receivedWeightKg: number | null;
  weightDifferenceKg: number | null;
  weightOutOfTolerance: boolean;
  locationLabel: string;
  note: string;
  evidencePath: string;
  evidenceUrl: string;
  scannedAt: string;
  scannedByName: string;
  package: {
    invoiceCode: string;
    shipmentCode: string;
    customerName: string;
    recipientName: string;
    country: string;
    paymentStatus: "pending" | "paid";
    collectionWeightKg: number | null;
  } | null;
};

export type WarehouseIntakeSession = {
  id: string;
  code: string;
  status: WarehouseIntakeStatus;
  intakeKind: WarehouseIntakeKind;
  routeId: string | null;
  routeName: string;
  vehicleName: string;
  driverName: string;
  warehouseId: string;
  warehouseName: string;
  expectedCount: number;
  startedAt: string;
  closedAt: string | null;
  closedByName: string;
  driverConfirmed: boolean;
  driverExceptionNote: string;
  summary: WarehouseIntakeSummary;
  items: WarehouseIntakeItem[];
};

export type WarehouseIntakeWarehouse = {
  id: string;
  name: string;
  isDefault: boolean;
};

export type WarehouseIntakeBin = {
  id: string;
  warehouseId: string;
  code: string;
  label: string;
};

export type WarehouseIntakeAvailablePackage = {
  id: string;
  code: string;
  invoiceCode: string;
  shipmentCode: string;
  customerName: string;
  recipientName: string;
  country: string;
  paymentStatus: "pending" | "paid";
  collectionWeightKg: number | null;
  truckRouteId: string | null;
};

export type WarehouseIntakeWorkspace = {
  sessions: WarehouseIntakeSession[];
  warehouses: WarehouseIntakeWarehouse[];
  bins: WarehouseIntakeBin[];
  availablePackages: WarehouseIntakeAvailablePackage[];
  toleranceKg: number;
  canReopen: boolean;
};

export function conditionNeedsEvidence(condition: WarehouseIntakeCondition) {
  return condition !== "correct";
}

export function defaultIntakeLocation(condition: WarehouseIntakeCondition) {
  return conditionNeedsEvidence(condition) ? "Cuarentena" : "Recepción pendiente";
}

export function buildWarehouseIntakeSummary(input: {
  expected: number;
  items: Array<{
    matchStatus: WarehouseIntakeItem["matchStatus"];
    condition: WarehouseIntakeCondition;
    weightDifferenceKg?: number | null;
    weightOutOfTolerance?: boolean;
    locationLabel?: string;
  }>;
}): WarehouseIntakeSummary {
  const expectedReceived = input.items.filter((item) => item.matchStatus === "expected").length;
  return {
    expected: Math.max(0, input.expected),
    received: input.items.length,
    missing: Math.max(0, input.expected - expectedReceived),
    unexpected: input.items.filter((item) => item.matchStatus === "unexpected").length,
    damaged: input.items.filter((item) => item.condition !== "correct" && item.condition !== "unidentified").length,
    unidentified: input.items.filter((item) => item.matchStatus === "unidentified").length,
    weightDifferences: input.items.filter((item) => item.weightOutOfTolerance).length,
    quarantine: input.items.filter((item) => item.locationLabel === "Cuarentena").length,
  };
}

export function warehouseIntakeHasExceptions(summary: WarehouseIntakeSummary) {
  return summary.missing > 0 || summary.unexpected > 0 || summary.damaged > 0 ||
    summary.unidentified > 0 || summary.weightDifferences > 0 || summary.quarantine > 0;
}

export function canScanWarehouseIntake(status: WarehouseIntakeStatus) {
  return status === "unloading" || status === "in_review";
}

export function warehouseIntakeNeedsDriverConfirmation(kind: WarehouseIntakeKind) {
  return kind === "truck_manifest";
}

export function warehouseIntakeCloseStatus(summary: WarehouseIntakeSummary): WarehouseIntakeStatus {
  return warehouseIntakeHasExceptions(summary) ? "completed_with_exceptions" : "completed";
}

export function validateWarehouseIntakeDraft(input: {
  code: string;
  condition: WarehouseIntakeCondition;
  weightKg: number | null;
  note: string;
  hasEvidence: boolean;
  isKnownPackage: boolean;
}) {
  if (!input.code.trim()) return { ok: false as const, error: "Escanea o escribe el código de la caja." };
  if (input.isKnownPackage && (!input.weightKg || input.weightKg <= 0)) {
    return { ok: false as const, error: "Indica el peso recibido en kg." };
  }
  if (!input.isKnownPackage && input.condition !== "unidentified") {
    return { ok: false as const, error: "Un código inexistente debe registrarse como caja no identificada." };
  }
  if (conditionNeedsEvidence(input.condition) && !input.note.trim()) {
    return { ok: false as const, error: "Describe cómo llegó la caja." };
  }
  if (conditionNeedsEvidence(input.condition) && !input.hasEvidence) {
    return { ok: false as const, error: "Toma una foto antes de confirmar la excepción." };
  }
  return { ok: true as const };
}
