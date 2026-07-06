import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compactStepClass,
  stepIsReachable,
} from "@/components/shipment-progress-steps";
import type { ShipmentProgressStep } from "@/lib/shipment-display";

function step(
  state: ShipmentProgressStep["state"],
  overrides: Partial<ShipmentProgressStep> = {},
): ShipmentProgressStep {
  return {
    id: "step-1",
    kind: "empty_box",
    title: "Dejar",
    detail: "",
    state,
    channel: "home",
    channelLabel: "Domicilio",
    ...overrides,
  };
}

describe("shipment progress steps", () => {
  it("only treats active and done steps as reachable", () => {
    assert.equal(stepIsReachable(step("active")), true);
    assert.equal(stepIsReachable(step("done")), true);
    assert.equal(stepIsReachable(step("pending")), false);
  });

  it("keeps logistics legs outlined until the driver task is ordered", () => {
    const awaiting = step("active", { awaitingOrder: true, driverTaskOrdered: false });
    assert.match(compactStepClass(awaiting, false), /bg-surface-card-header/);
    assert.doesNotMatch(compactStepClass(awaiting, false), /bg-amber-400/);

    const marked = step("active", { driverTaskOrdered: true });
    assert.match(compactStepClass(marked, false), /bg-amber-400/);
  });
});
