export type UsdMoney = Readonly<{
  currency: "USD";
  amountCents: number;
}>;

export type OpenBalanceStatus = "pending" | "partially_paid" | "paid";
export type PaymentApplicationStatus = "received" | "partially_applied" | "applied";

function assertCents(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} debe ser un entero seguro en centavos`);
  }
}

export function usd(amountCents: number): UsdMoney {
  assertCents(amountCents, "amountCents");
  return { currency: "USD", amountCents };
}

export function addUsd(...amounts: readonly UsdMoney[]): UsdMoney {
  const amountCents = amounts.reduce((total, amount) => {
    if (amount.currency !== "USD") {
      throw new Error("Solo se admite USD");
    }
    return total + amount.amountCents;
  }, 0);
  assertCents(amountCents, "total");
  return usd(amountCents);
}

export function multiplyUsd(unitAmount: UsdMoney, quantity: number): UsdMoney {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error("quantity debe ser un entero positivo");
  }
  return usd(unitAmount.amountCents * quantity);
}

export function remainingCents(amountCents: number, appliedCents: number, reversedCents = 0): number {
  for (const [value, label] of [
    [amountCents, "amountCents"],
    [appliedCents, "appliedCents"],
    [reversedCents, "reversedCents"],
  ] as const) {
    assertCents(value, label);
    if (value < 0) throw new Error(`${label} no puede ser negativo`);
  }
  return Math.max(0, amountCents - appliedCents - reversedCents);
}

export function openBalanceStatus(
  amountCents: number,
  appliedCents: number,
  reversedCents = 0,
): OpenBalanceStatus {
  const remaining = remainingCents(amountCents, appliedCents, reversedCents);
  if (remaining === 0) return "paid";
  if (appliedCents > 0 || reversedCents > 0) return "partially_paid";
  return "pending";
}

export function paymentApplicationStatus(amountCents: number, appliedCents: number): PaymentApplicationStatus {
  assertCents(amountCents, "amountCents");
  assertCents(appliedCents, "appliedCents");
  if (amountCents <= 0 || appliedCents < 0 || appliedCents > amountCents) {
    throw new Error("Aplicación de pago inválida");
  }
  if (appliedCents === 0) return "received";
  if (appliedCents === amountCents) return "applied";
  return "partially_applied";
}

export function journalIsBalanced(
  lines: readonly Readonly<{ debitCents: number; creditCents: number }>[],
): boolean {
  if (lines.length < 2) return false;
  let debit = 0;
  let credit = 0;
  for (const line of lines) {
    assertCents(line.debitCents, "debitCents");
    assertCents(line.creditCents, "creditCents");
    if (line.debitCents < 0 || line.creditCents < 0) return false;
    if ((line.debitCents === 0) === (line.creditCents === 0)) return false;
    debit += line.debitCents;
    credit += line.creditCents;
  }
  return debit > 0 && debit === credit;
}
