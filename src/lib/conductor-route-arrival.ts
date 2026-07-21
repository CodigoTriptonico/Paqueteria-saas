export const conductorRouteArrivalReasons = [
  "completed_normally",
  "unfinished_stops",
  "vehicle_problem",
  "other",
] as const;

export type ConductorRouteArrivalReason = (typeof conductorRouteArrivalReasons)[number];

export const conductorRouteArrivalReasonLabel: Record<ConductorRouteArrivalReason, string> = {
  completed_normally: "Terminé todo",
  unfinished_stops: "Quedaron entregas",
  vehicle_problem: "Problema con el camión",
  other: "Otra razón",
};

export const conductorRouteArrivalReasonHelp: Record<ConductorRouteArrivalReason, string> = {
  completed_normally: "Hice todas las paradas.",
  unfinished_stops: "Regreso con trabajo pendiente.",
  vehicle_problem: "El vehículo tuvo una novedad.",
  other: "Escribiré lo que pasó.",
};

export type ConductorArrivalWarehouse = {
  id: string;
  name: string;
  code: string;
  isDefault: boolean;
};

export type ConductorRouteReadyForArrival = {
  id: string;
  name: string;
  routeDate: string;
  plannedWarehouseId: string | null;
  vehicleLabel: string;
  stopCount: number;
  completedStops: number;
  exceptionStops: number;
};

export type ConductorRouteArrivalWorkspace = {
  routes: ConductorRouteReadyForArrival[];
  warehouses: ConductorArrivalWarehouse[];
};

export function routeIsReadyForArrival(input: {
  status: string;
  stopOutcomes: ReadonlyArray<string | null | undefined>;
}) {
  return input.status === "in_progress"
    && input.stopOutcomes.length > 0
    && input.stopOutcomes.every((outcome) =>
      outcome === "completed" || outcome === "failed" || outcome === "cancelled",
    );
}

export function validateConductorRouteArrival(input: {
  warehouseId: string;
  reason: string;
  note: string;
  hasExceptions: boolean;
}): { ok: true; reason: ConductorRouteArrivalReason } | { ok: false; error: string } {
  if (!input.warehouseId.trim()) {
    return { ok: false, error: "Toca la bodega donde dejaste las cajas." };
  }

  if (!conductorRouteArrivalReasons.includes(input.reason as ConductorRouteArrivalReason)) {
    return { ok: false, error: "Toca una razón para terminar la ruta." };
  }

  if (input.hasExceptions && input.reason === "completed_normally") {
    return { ok: false, error: "La ruta tiene paradas pendientes. Elige la razón que explique lo ocurrido." };
  }

  if (input.reason === "other" && input.note.trim().length < 3) {
    return { ok: false, error: "Escribe en pocas palabras qué pasó." };
  }

  return { ok: true, reason: input.reason as ConductorRouteArrivalReason };
}

