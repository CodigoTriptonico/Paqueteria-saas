import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { logisticsLegCancelCopy } from "@/lib/shipment-leg-cancel-confirm";

describe("logisticsLegCancelCopy", () => {
  it("builds destructive copy for canceling a driver leg", () => {
    const copy = logisticsLegCancelCopy("No dejar", "Dejar");

    assert.equal(copy.title, "¿No dejar?");
    assert.match(copy.message, /Se quita el aviso a logística/i);
    assert.match(copy.message, /dejar/i);
    assert.equal(copy.confirmLabel, "No dejar");
    assert.equal(copy.tone, "danger");
  });
});
