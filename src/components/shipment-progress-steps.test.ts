import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { stepIsReachable } from "@/components/shipment-progress-steps";
import type { ShipmentProgressStep } from "@/lib/shipment-display";

function step(state: ShipmentProgressStep["state"]): ShipmentProgressStep {
  return {
    id: "step-1",
    kind: "empty_box",
    title: "Dejar",
    detail: "",
    state,
    channel: "home",
    channelLabel: "Domicilio",
  };
}

describe("shipment progress steps", () => {
  it("only treats active and done steps as reachable", () => {
    assert.equal(stepIsReachable(step("active")), true);
    assert.equal(stepIsReachable(step("done")), true);
    assert.equal(stepIsReachable(step("pending")), false);
  });
});
