import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { saleStepCompactLabel } from "@/components/sale/venta-parts";

describe("saleStepCompactLabel", () => {
  it("returns short mobile labels that fit narrow step tiles", () => {
    assert.equal(saleStepCompactLabel("client"), "Remite");
    assert.equal(saleStepCompactLabel("recipient"), "Destino");
    assert.equal(saleStepCompactLabel("box"), "Caja");
    assert.equal(saleStepCompactLabel("delivery"), "Logíst.");
    assert.equal(saleStepCompactLabel("finish"), "Final");
  });
});
