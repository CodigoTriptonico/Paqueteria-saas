export type AgencyRateDraftLine = Readonly<{
  destinationCode: string;
  productCode: string;
  amountCents: number;
}>;

/** Converts the compact USD inputs used by the agency-rate panel into cents. */
export function parseUsdInputToCents(value: string): number {
  const normalized = value.trim().replace(/^\$/, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Escribe un monto USD válido con hasta dos decimales.");
  }

  const [whole, fraction = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new Error("El monto debe ser un valor positivo válido.");
  }
  return cents;
}

export function formatUsdInput(amountCents: number): string {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) {
    throw new Error("Los centavos deben ser un entero positivo válido.");
  }
  return (amountCents / 100).toFixed(2);
}

export function agencyRateLineKey(destinationCode: string, productCode: string): string {
  return `${destinationCode.trim().toUpperCase()}::${productCode.trim()}`;
}

export function validateAgencyRateDraft(lines: readonly AgencyRateDraftLine[]): void {
  const seen = new Set<string>();
  for (const line of lines) {
    const key = agencyRateLineKey(line.destinationCode, line.productCode);
    if (!line.destinationCode.trim() || !line.productCode.trim() || seen.has(key)) {
      throw new Error("La tarifa tiene un país o producto repetido o inválido.");
    }
    if (!Number.isSafeInteger(line.amountCents) || line.amountCents < 0) {
      throw new Error("Cada tarifa debe ser un monto válido en centavos.");
    }
    seen.add(key);
  }
}

/** The agency margin is display-only: only its own public price can change it. */
export function agencyBoxMarginCents(matrixRateCents: number, publicPriceCents: number): number {
  if (!Number.isSafeInteger(matrixRateCents) || !Number.isSafeInteger(publicPriceCents)) {
    throw new Error("Los precios deben ser montos enteros en centavos.");
  }
  return publicPriceCents - matrixRateCents;
}
