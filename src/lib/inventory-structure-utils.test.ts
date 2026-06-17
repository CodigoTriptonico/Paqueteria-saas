import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { CategoryConfig } from "@/lib/inventory-tree";
import {
  categoryLeafEntries,
  formatScopedItemCount,
  sameStockLeaf,
} from "./inventory-structure-utils";

const sampleTree: CategoryConfig = {
  name: "Cajas",
  items: [
    {
      id: "sub-1",
      name: "Medidas",
      children: [
        { id: "1", name: "12x12x12" },
        { id: "2", name: "14x14x14" },
      ],
    },
  ],
};

describe("inventory-structure-utils", () => {
  it("formats scoped item counts", () => {
    assert.equal(formatScopedItemCount(1, "Cajas"), "1 item en Cajas");
    assert.equal(formatScopedItemCount(3, "Cajas"), "3 items en Cajas");
  });

  it("lists category leaf entries including subcategories", () => {
    const entries = categoryLeafEntries(sampleTree);

    assert.equal(entries.length, 2);
    assert.equal(entries[0]?.subcategoryName, "Medidas");
    assert.equal(entries[0]?.item.name, "12x12x12");
  });

  it("matches stock leaves without accent sensitivity", () => {
    assert.equal(
      sameStockLeaf(
        {
          id: "1",
          name: "Rojo",
          category: "Cajas",
          kind: "Rojo",
          subcategory: "Colores",
          stock: 1,
          reserved: 0,
          assigned: 0,
          unavailable: 0,
          minStock: 2,
        },
        "Cajas",
        "rojo",
        "colores",
      ),
      true,
    );
  });
});
