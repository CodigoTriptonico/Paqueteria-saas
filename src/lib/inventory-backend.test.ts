import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  categoriesToConfig,
  dedupeInventoryCategoryRows,
  type DbCategory,
} from "./inventory-backend";

describe("inventory-backend category rows", () => {
  it("dedupes categories that only differ by case and merges tree data", () => {
    const rows: DbCategory[] = [
      {
        id: "lowercase-with-items",
        name: "cajas",
        tree_data: [],
      },
      {
        id: "mixed-with-tree",
        name: "Cajas",
        tree_data: [
          { id: "1", name: "14x14x14" },
          { id: "2", name: "18x18x18" },
        ],
      },
    ];

    const deduped = dedupeInventoryCategoryRows(rows);

    assert.equal(deduped.length, 1);
    assert.equal(deduped[0]?.name, "Cajas");
    assert.equal(deduped[0]?.tree_data.length, 2);
    assert.deepEqual(categoriesToConfig(rows), [
      {
        name: "Cajas",
        items: [
          { id: "1", name: "14x14x14" },
          { id: "2", name: "18x18x18" },
        ],
      },
    ]);
  });
});
