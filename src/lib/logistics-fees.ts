export type LogisticsFeeConfig = {
  emptyBoxDeliveryFee: string;
  fullBoxPickupFee: string;
};

export const emptyLogisticsFeeConfig: LogisticsFeeConfig = {
  emptyBoxDeliveryFee: "$0",
  fullBoxPickupFee: "$0",
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
}) {
  void input;
  const emptyBoxDelivery = 0;
  const fullBoxPickup = 0;
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
  void fee;
  return "";
}
