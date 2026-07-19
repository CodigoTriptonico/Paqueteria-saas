export type CommercialAudience = "agency" | "seller";
export type CommercialPriceKind = "public" | "internal" | "additional_service";
export type CommercialSourceLevel = "country" | "group" | "entity";

export type CommercialPriceCandidate = Readonly<{
  amountCents: number;
  currency: string;
  sourceLevel: CommercialSourceLevel;
  sourceId?: string | null;
  validFrom?: string | null;
}>;

export type EffectiveCommercialPrice = CommercialPriceCandidate & Readonly<{
  inherited: boolean;
}>;

function assertCandidate(candidate: CommercialPriceCandidate, label: string) {
  if (!Number.isSafeInteger(candidate.amountCents) || candidate.amountCents < 0) {
    throw new Error(`${label}: monto invalido`);
  }
  if (!/^[A-Z]{3}$/.test(candidate.currency)) {
    throw new Error(`${label}: moneda invalida`);
  }
}

/**
 * Single deterministic precedence contract shared by agency and seller UI.
 * PostgreSQL applies the same order before persisting any operational snapshot.
 */
export function resolveEffectiveCommercialPrice(input: Readonly<{
  country: CommercialPriceCandidate;
  group?: CommercialPriceCandidate | null;
  entity?: CommercialPriceCandidate | null;
}>): EffectiveCommercialPrice {
  assertCandidate(input.country, "Pais");
  if (input.group) assertCandidate(input.group, "Grupo");
  if (input.entity) assertCandidate(input.entity, "Entidad");

  const resolved = input.entity ?? input.group ?? input.country;
  return {
    ...resolved,
    inherited: resolved.sourceLevel !== "entity",
  };
}
