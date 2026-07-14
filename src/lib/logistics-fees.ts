export type LogisticsFeeConfig = {
  emptyBoxDeliveryFee: string;
  fullBoxPickupFee: string;
};


export function parseMoneyValue(value: string) {
  return Number(value.replace(/[^\d.-]/g, "")) || 0;
}

/** Vacío en el input cuando el valor guardado es $0; el placeholder muestra el cero. */
export function moneyInputDisplayValue(value: string) {
  if (parseMoneyValue(value) <= 0) {
    return "";
  }

  return value.replace("$", "");
}

export function formatMoneyValue(amount: number) {
  if (amount <= 0) {
    return "$0";
  }

  const rounded = Math.round(amount * 100) / 100;
  return rounded % 1 === 0 ? `$${rounded}` : `$${rounded.toFixed(2)}`;
}

export function normalizeMoneyInput(rawPrice: string) {
  const digits = rawPrice.replace(/[^\d.]/g, "");
  return digits ? `$${digits}` : "$0";
}

export function computeLogisticsFees(input: {
  emptyBoxDriver: boolean;
  fullBoxDriver: boolean;
  fees: LogisticsFeeConfig;
  boxCount?: number;
  logisticsFeeMode?: "per_shipment" | "per_box";
}) {
  const multiplier = input.logisticsFeeMode === "per_box" ? Math.max(1, input.boxCount || 1) : 1;
  const emptyBoxDelivery = input.emptyBoxDriver
    ? parseMoneyValue(input.fees.emptyBoxDeliveryFee) * multiplier
    : 0;
  const fullBoxPickup = input.fullBoxDriver
    ? parseMoneyValue(input.fees.fullBoxPickupFee) * multiplier
    : 0;
  const total = emptyBoxDelivery + fullBoxPickup;

  return {
    emptyBoxDelivery,
    fullBoxPickup,
    total,
    emptyBoxDeliveryLabel: formatMoneyValue(emptyBoxDelivery),
    fullBoxPickupLabel: formatMoneyValue(fullBoxPickup),
    totalLabel: formatMoneyValue(total),
  };
}

export function logisticsDriverFeeLabel(fee: string) {
  return parseMoneyValue(fee) > 0 ? formatMoneyValue(parseMoneyValue(fee)) : "";
}
