import { formatMoneyValue, normalizeMoneyInput, parseMoneyValue } from "@/lib/logistics-fees";

export type ShipmentCollectMode = "choose" | "full" | "partial";

export function resolveShipmentCollectAmount(
  rawAmount: string | undefined,
  balanceDue: number,
): { ok: true; amount: number; isFullPayment: boolean } | { ok: false; error: string } {
  const balance = Math.round(balanceDue * 100) / 100;

  if (balance <= 0) {
    return { ok: false, error: "Este invoice no tiene pendiente" };
  }

  const trimmed = rawAmount?.trim() || "";
  const amount =
    trimmed === ""
      ? balance
      : Math.round(parseMoneyValue(normalizeMoneyInput(trimmed)) * 100) / 100;

  if (amount <= 0) {
    return { ok: false, error: "El monto debe ser mayor a cero" };
  }

  if (amount > balance) {
    return { ok: false, error: `El monto no puede superar ${formatMoneyValue(balance)}` };
  }

  return {
    ok: true,
    amount,
    isFullPayment: amount >= balance,
  };
}

export function shipmentCollectCopy(balanceDue: number, mode: ShipmentCollectMode) {
  const pending = formatMoneyValue(balanceDue);

  if (mode === "choose") {
    return {
      title: "¿Cómo quieres cobrar?",
      confirmLabel: "",
      confirmingLabel: "",
      fullOptionLabel: "Pago completo",
      fullOptionDetail: `Cobrar ${pending} y cerrar la factura`,
      partialOptionLabel: "Abono",
      partialOptionDetail: "Registrar un pago parcial del pendiente",
    };
  }

  if (mode === "partial") {
    return {
      title: "Registrar abono",
      amountLabel: "Monto del abono",
      pendingLineLabel: "Pendiente después",
      confirmLabel: "Registrar abono",
      confirmingLabel: "Registrando...",
    };
  }

  return {
    title: "¿Cobrar pendiente?",
    pendingLineLabel: "Vas a cobrar",
    confirmLabel: `Cobrar ${pending}`,
    confirmingLabel: "Cobrando...",
  };
}

export function shipmentCollectSuccessMessage(code: string, amount: number, isFullPayment: boolean) {
  if (isFullPayment) {
    return `Invoice ${code} cobrado`;
  }

  return `Abono de ${formatMoneyValue(amount)} registrado en ${code}`;
}
