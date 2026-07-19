import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveEffectiveCommercialPrice } from "@/lib/commercial-config/resolver";

const country = { amountCents: 15_000, currency: "USD", sourceLevel: "country" as const };
const group = { amountCents: 14_000, currency: "USD", sourceLevel: "group" as const };
const entity = { amountCents: 13_000, currency: "USD", sourceLevel: "entity" as const };

describe("commercial price precedence", () => {
  it("inherits the country value when no override exists", () => {
    assert.deepEqual(resolveEffectiveCommercialPrice({ country }), { ...country, inherited: true });
  });

  it("uses the audience group over the country", () => {
    assert.deepEqual(resolveEffectiveCommercialPrice({ country, group }), { ...group, inherited: true });
  });

  it("uses the entity over group and country", () => {
    assert.deepEqual(resolveEffectiveCommercialPrice({ country, group, entity }), { ...entity, inherited: false });
  });

  it("returns to the inherited group value after removing the entity override", () => {
    assert.equal(resolveEffectiveCommercialPrice({ country, group, entity: null }).amountCents, 14_000);
  });

  it("uses exactly the same contract for sellers and agencies", () => {
    const seller = resolveEffectiveCommercialPrice({ country, group, entity });
    const agency = resolveEffectiveCommercialPrice({ country, group, entity });
    assert.deepEqual(seller, agency);
  });

  it("rejects fractional or negative money", () => {
    assert.throws(() => resolveEffectiveCommercialPrice({ country: { ...country, amountCents: 10.5 } }), /monto invalido/);
    assert.throws(() => resolveEffectiveCommercialPrice({ country: { ...country, amountCents: -1 } }), /monto invalido/);
  });
});
