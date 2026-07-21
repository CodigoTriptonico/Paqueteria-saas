import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  readBoxLinesFromLogisticsPlan,
  shipmentBoxLinesDetailLabel,
} from "./shipment-display.ts";

describe("readBoxLinesFromLogisticsPlan", () => {
  it("reads labeled box lines from logistics_plan", () => {
    const lines = readBoxLinesFromLogisticsPlan({
      boxLines: [
        { label: "Caja M", quantity: 2 },
        { label: "Caja L", quantity: 1 },
      ],
    });

    assert.deepEqual(
      lines.map((line) => ({ label: line.label, quantity: line.quantity })),
      [
        { label: "Caja M", quantity: 2 },
        { label: "Caja L", quantity: 1 },
      ],
    );
    assert.equal(shipmentBoxLinesDetailLabel(lines), "(2) Caja M + (1) Caja L");
  });

  it("falls back to legacy single box fields", () => {
    const lines = readBoxLinesFromLogisticsPlan({
      box: { label: "Caja XL" },
      boxCount: 3,
    });

    assert.equal(lines.length, 1);
    assert.equal(lines[0].label, "Caja XL");
    assert.equal(lines[0].quantity, 3);
  });
});
