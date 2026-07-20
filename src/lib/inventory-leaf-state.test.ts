import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  inventoryLeafStateToItem,
  normalizeInventoryLeafInput,
} from "@/lib/inventory-leaf-state";

describe("inventory leaf state", () => {
  it("normalizes one leaf contract for ensure and movement actions", () => {
    assert.deepEqual(
      normalizeInventoryLeafInput({
        warehouseId: "warehouse-1",
        category: "  Cajas ",
        kind: "  ",
        itemName: " Mediana ",
        subcategory: " Nacional ",
      }),
      {
        categoryName: "Cajas",
        itemName: "Mediana",
        kind: "Mediana",
        subcategory: "Nacional",
        minStock: 2,
      },
    );
  });

  it("maps the shared leaf state and accepts the atomic movement stock", () => {
    const state = {
      categoryName: "Cajas",
      itemName: "Mediana",
      kind: "Mediana",
      subcategory: null,
      minStock: 2,
      itemRow: {
        id: "item-1",
        name: "Mediana",
        kind: "Mediana",
        subcategory: null,
        size: "M",
        location: null,
        unit: "pieza",
      },
      stockRow: {
        id: "stock-1",
        stock: 0,
        reserved: 1,
        assigned: 2,
        unavailable: 3,
        min_stock: 4,
      },
    };

    assert.deepEqual(inventoryLeafStateToItem(state, 8), {
      id: "item-1",
      name: "Mediana",
      category: "Cajas",
      kind: "Mediana",
      subcategory: undefined,
      size: "M",
      stock: 8,
      reserved: 1,
      assigned: 2,
      unavailable: 3,
      minStock: 4,
      avgCost: 0,
      location: undefined,
      unit: "pieza",
    });

    assert.equal(inventoryLeafStateToItem(state, 8, 4.5).avgCost, 4.5);
  });
});
