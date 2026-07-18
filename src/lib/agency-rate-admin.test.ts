import assert from "node:assert/strict";
import test from "node:test";
import { agencyRateLineKey, formatUsdInput, parseUsdInputToCents, validateAgencyRateDraft } from "@/lib/agency-rate-admin";

test("las tarifas de agencia convierten USD a centavos sin redondeo flotante", () => {
  assert.equal(parseUsdInputToCents("12.5"), 1250);
  assert.equal(parseUsdInputToCents("$0.01"), 1);
  assert.equal(formatUsdInput(1250), "12.50");
  assert.throws(() => parseUsdInputToCents("12.345"), /USD válido/);
});

test("la matriz de tarifas no acepta líneas duplicadas", () => {
  assert.throws(
    () => validateAgencyRateDraft([
      { destinationCode: "MX", productCode: "MEDIANA", amountCents: 100 },
      { destinationCode: "mx", productCode: "MEDIANA", amountCents: 200 },
    ]),
    /repetido/,
  );
  assert.equal(agencyRateLineKey("mx", "MEDIANA"), "MX::MEDIANA");
});
