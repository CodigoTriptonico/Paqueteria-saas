import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildWarehouseBinCode,
  buildWarehouseBinLabel,
  formatBinPlacementSummary,
  sumBinPlacementQuantity,
  unplacedWarehouseQuantity,
  validateBinPlacementQuantity,
} from "./inventory-bins";

describe("inventory-bins", () => {
  it("builds bin codes from zone, aisle and shelf", () => {
    assert.equal(
      buildWarehouseBinCode({ zone: "A", aisle: "2", shelf: "3" }),
      "A-2-3",
    );
    assert.equal(
      buildWarehouseBinCode({ zone: "A", aisle: "2", shelf: "3", code: "rack-01" }),
      "RACK-01",
    );
  });

  it("builds readable bin labels", () => {
    assert.equal(
      buildWarehouseBinLabel({
        zone: "A",
        aisle: "2",
        shelf: "3",
        code: "A-2-3",
      }),
      "Zona A · Pasillo 2 · Estante 3",
    );
  });

  it("validates placement totals against warehouse stock", () => {
    const result = validateBinPlacementQuantity({
      warehouseStock: 100,
      placements: [{ binId: "bin-a", quantity: 40 }],
      binId: "bin-b",
      nextQuantity: 70,
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /Solo puedes ubicar 60/);
    }
  });

  it("computes unplaced warehouse quantity", () => {
    assert.equal(
      unplacedWarehouseQuantity(100, [
        { quantity: 30 },
        { quantity: 20 },
      ]),
      50,
    );
    assert.equal(sumBinPlacementQuantity([{ quantity: 10 }, { quantity: 5 }]), 15);
  });

  it("formats placement summaries for item cards", () => {
    assert.equal(
      formatBinPlacementSummary([
        { binId: "1", binCode: "A-1", binLabel: "Zona A", quantity: 40 },
        { binId: "2", binCode: "B-2", binLabel: "Zona B", quantity: 10 },
        { binId: "3", binCode: "C-3", binLabel: "Zona C", quantity: 5 },
      ]),
      "A-1: 40 · B-2: 10 · +1",
    );
  });
});
