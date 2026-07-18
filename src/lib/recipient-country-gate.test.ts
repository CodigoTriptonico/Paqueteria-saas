import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { recipientCountrySetupRequired } from "./recipient-country-gate";

describe("recipient-country-gate", () => {
  it("requires destination setup when the organization has no countries", () => {
    assert.equal(recipientCountrySetupRequired([]), true);
    assert.equal(recipientCountrySetupRequired(["   "]), true);
  });

  it("allows recipient creation once at least one destination exists", () => {
    assert.equal(recipientCountrySetupRequired(["Mexico"]), false);
  });
});
