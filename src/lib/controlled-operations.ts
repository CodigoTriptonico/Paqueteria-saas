export type OperationalExceptionType =
  | "not_delivered"
  | "damaged"
  | "lost"
  | "weight_difference"
  | "cancel_pre_departure";

export type CustodyHolderType = "agency" | "conductor" | "bodega" | "paleta" | "proveedor";

export const exceptionTypeLabel: Record<OperationalExceptionType, string> = {
  not_delivered: "No se pudo entregar",
  damaged: "Daño",
  lost: "Extravío",
  weight_difference: "Diferencia de peso",
  cancel_pre_departure: "Cancelación antes de salida",
};

export const custodyHolderLabel: Record<CustodyHolderType, string> = {
  agency: "Agencia",
  conductor: "Conductor",
  bodega: "Bodega",
  paleta: "Paleta",
  proveedor: "Proveedor",
};

export function exceptionNeedsSecondApproval(type: OperationalExceptionType) {
  return ["damaged", "lost", "weight_difference", "cancel_pre_departure"].includes(type);
}

export function closeDifferenceMessage(expectedCashCents: number, countedCashCents: number) {
  const difference = countedCashCents - expectedCashCents;
  if (!difference) return "Caja cuadrada";
  return difference > 0 ? `Sobra ${difference} centavos` : `Faltan ${Math.abs(difference)} centavos`;
}
