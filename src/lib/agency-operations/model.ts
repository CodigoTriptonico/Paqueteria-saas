export type AgencyRequestStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "confirmed"
  | "scheduled"
  | "assigned"
  | "in_route"
  | "partially_completed"
  | "completed"
  | "rejected"
  | "cancelled";

const AGENCY_REQUEST_TRANSITIONS: Readonly<Record<AgencyRequestStatus, readonly AgencyRequestStatus[]>> = {
  draft: ["submitted", "cancelled"],
  submitted: ["under_review", "rejected", "cancelled"],
  under_review: ["confirmed", "rejected", "cancelled"],
  confirmed: ["scheduled", "cancelled"],
  scheduled: ["assigned", "cancelled"],
  assigned: ["in_route", "cancelled"],
  in_route: ["partially_completed", "completed"],
  partially_completed: ["assigned", "in_route", "completed", "cancelled"],
  completed: [],
  rejected: [],
  cancelled: [],
};

type AgencyServiceKind =
  | "empty_box_delivery"
  | "full_box_pickup"
  | "home_delivery"
  | "home_pickup"
  | "additional_service";

export type AgencyVisitLineConfirmation = {
  id: string;
  kind: AgencyServiceKind;
  requestedQuantity: number;
  confirmedQuantity: number;
  differenceReason?: string | null;
};

export type ConfirmedAgencyVisitLine = AgencyVisitLineConfirmation & {
  differenceQuantity: number;
};

export type BoxSource = "matrix_purchased" | "own_box";

export type AgencyBoxLot = {
  id: string;
  deliveredAt: string;
  deliveredQuantity: number;
  allocatedQuantity: number;
};

export type BoxLotAllocation = {
  lotId: string;
  quantity: number;
};

export function isAgencyRequestTransitionAllowed(
  from: AgencyRequestStatus,
  to: AgencyRequestStatus,
): boolean {
  return AGENCY_REQUEST_TRANSITIONS[from].includes(to);
}

function assertNonNegativeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} debe ser un entero no negativo`);
  }
}

export function confirmAgencyVisitLines(
  lines: readonly AgencyVisitLineConfirmation[],
): ConfirmedAgencyVisitLine[] {
  if (lines.length === 0) {
    throw new Error("La visita debe incluir al menos una linea");
  }

  const ids = new Set<string>();
  return lines.map((line) => {
    if (!line.id.trim() || ids.has(line.id)) {
      throw new Error("Cada linea de visita debe tener un ID unico");
    }
    ids.add(line.id);
    assertNonNegativeInteger(line.requestedQuantity, "requestedQuantity");
    assertNonNegativeInteger(line.confirmedQuantity, "confirmedQuantity");

    const differenceQuantity = line.confirmedQuantity - line.requestedQuantity;
    if (differenceQuantity !== 0 && !line.differenceReason?.trim()) {
      throw new Error("Toda diferencia confirmada requiere motivo");
    }

    return { ...line, differenceQuantity };
  });
}

export function allocateAgencyBoxesFifo(input: {
  source: BoxSource;
  quantity: number;
  lots: readonly AgencyBoxLot[];
}): { allocations: BoxLotAllocation[]; unfulfilledQuantity: number } {
  assertNonNegativeInteger(input.quantity, "quantity");

  if (input.source === "own_box" || input.quantity === 0) {
    return { allocations: [], unfulfilledQuantity: 0 };
  }

  const orderedLots = [...input.lots]
    .map((lot) => {
      assertNonNegativeInteger(lot.deliveredQuantity, "deliveredQuantity");
      assertNonNegativeInteger(lot.allocatedQuantity, "allocatedQuantity");
      if (lot.allocatedQuantity > lot.deliveredQuantity) {
        throw new Error("Un lote no puede tener mas cajas asignadas que entregadas");
      }
      const timestamp = Date.parse(lot.deliveredAt);
      if (!Number.isFinite(timestamp)) {
        throw new Error("deliveredAt debe ser una fecha valida");
      }
      return { ...lot, timestamp };
    })
    .sort((left, right) => left.timestamp - right.timestamp || left.id.localeCompare(right.id));

  let remaining = input.quantity;
  const allocations: BoxLotAllocation[] = [];
  for (const lot of orderedLots) {
    if (remaining === 0) break;
    const available = lot.deliveredQuantity - lot.allocatedQuantity;
    if (available === 0) continue;
    const quantity = Math.min(available, remaining);
    allocations.push({ lotId: lot.id, quantity });
    remaining -= quantity;
  }

  return { allocations, unfulfilledQuantity: remaining };
}

export function agencyRequestOutcome(lines: readonly ConfirmedAgencyVisitLine[]):
  | "completed"
  | "partially_completed" {
  return lines.some((line) => line.confirmedQuantity !== line.requestedQuantity)
    ? "partially_completed"
    : "completed";
}
