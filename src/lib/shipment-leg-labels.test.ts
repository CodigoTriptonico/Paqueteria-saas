import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EMPTY_BOX_LEG_LABELS, FULL_BOX_LEG_LABELS } from "./shipment-leg-labels";

describe("shipment-leg-labels", () => {
  it("uses the same verb family for empty box actions", () => {
    assert.equal(EMPTY_BOX_LEG_LABELS.short, "Dejar");
    assert.match(EMPTY_BOX_LEG_LABELS.ready, /dejar/i);
    assert.match(EMPTY_BOX_LEG_LABELS.cancel, /dejar/i);
    assert.equal(EMPTY_BOX_LEG_LABELS.auditStep, EMPTY_BOX_LEG_LABELS.short);
  });

  it("uses the same verb family for full box actions", () => {
    assert.equal(FULL_BOX_LEG_LABELS.short, "Recoger");
    assert.match(FULL_BOX_LEG_LABELS.ready, /recoger/i);
    assert.match(FULL_BOX_LEG_LABELS.cancel, /recoger/i);
    assert.equal(FULL_BOX_LEG_LABELS.auditStep, FULL_BOX_LEG_LABELS.short);
  });
});
