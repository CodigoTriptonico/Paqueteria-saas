import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextQuickBoxSelection } from "@/lib/sale-quick-box-selection";

describe("quick-sale box quantity", () => {
  it("starts a clicked box at one and increments repeat clicks", () => {
    assert.deepEqual(
      nextQuickBoxSelection({ boxKey: "", quantity: 0 }, "30x30x30", "add"),
      { boxKey: "30x30x30", quantity: 1 },
    );
    assert.deepEqual(
      nextQuickBoxSelection({ boxKey: "30x30x30", quantity: 2 }, "30x30x30", "add"),
      { boxKey: "30x30x30", quantity: 3 },
    );
  });

  it("starts a different box at one instead of carrying the previous quantity", () => {
    assert.deepEqual(
      nextQuickBoxSelection({ boxKey: "30x30x30", quantity: 3 }, "19x19x19", "add"),
      { boxKey: "19x19x19", quantity: 1 },
    );
  });

  it("decrements with remove and clears the last unit", () => {
    assert.deepEqual(
      nextQuickBoxSelection({ boxKey: "19x19x19", quantity: 3 }, "19x19x19", "remove"),
      { boxKey: "19x19x19", quantity: 2 },
    );
    assert.deepEqual(
      nextQuickBoxSelection({ boxKey: "19x19x19", quantity: 1 }, "19x19x19", "remove"),
      { boxKey: "", quantity: 0 },
    );
  });

  it("ignores removal from an unselected box", () => {
    assert.deepEqual(
      nextQuickBoxSelection({ boxKey: "19x19x19", quantity: 2 }, "30x30x30", "remove"),
      { boxKey: "19x19x19", quantity: 2 },
    );
  });
});
