import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_INVENTORY_UNIT,
  formatInventoryStockLabel,
  formatInventoryUnitPlural,
  normalizeInventoryUnit,
  resolveInventoryItemUnit,
} from "@/lib/inventory-units";

describe("inventory-units", () => {
  it("normalizes units to lowercase trimmed values", () => {
    assert.equal(normalizeInventoryUnit("  Pieza "), "pieza");
    assert.equal(normalizeInventoryUnit(""), "");
  });

  it("resolves leaf unit with default fallback", () => {
    assert.equal(resolveInventoryItemUnit({ unit: "caja" }), "caja");
    assert.equal(resolveInventoryItemUnit({ unit: undefined }), DEFAULT_INVENTORY_UNIT);
    assert.equal(
      resolveInventoryItemUnit({ unit: undefined }, [{ unit: "rollo" }]),
      "rollo",
    );
  });

  it("formats plural labels for stock display", () => {
    assert.equal(formatInventoryUnitPlural("pieza", 1), "pieza");
    assert.equal(formatInventoryUnitPlural("pieza", 12), "piezas");
    assert.equal(formatInventoryUnitPlural("kg", 5), "kg");
    assert.equal(
      formatInventoryStockLabel({ unit: "caja" }, 3),
      "cajas",
    );
  });
});
