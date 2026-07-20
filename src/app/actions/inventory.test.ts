import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const actionsDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(actionsDir, "inventory.ts"), "utf8");

describe("inventory history protection", () => {
  it("checks category deletion before deleting category rows", () => {
    const guardIndex = source.indexOf(
      "await assertCategoryDeletionDoesNotBreakHistory(",
    );
    const deleteIndex = source.indexOf(
      '.from("inventory_categories")\n        .delete()',
    );

    assert.ok(guardIndex >= 0);
    assert.ok(deleteIndex >= 0);
    assert.ok(guardIndex < deleteIndex);
    assert.match(source, /No se puede eliminar una categoría con historial/);
  });

  it("never deletes an inventory item during warehouse stock pruning", () => {
    const pruneStart = source.indexOf(
      "async function pruneWarehouseItemsNotInTree",
    );
    const pruneEnd = source.indexOf(
      "async function assertCategoryDeletionDoesNotBreakHistory",
    );
    const pruneSource = source.slice(pruneStart, pruneEnd);

    assert.doesNotMatch(
      pruneSource,
      /from\("inventory_items"\)[\s\S]*?\.delete\(\)/,
    );
    assert.match(pruneSource, /ledger anchor/);
  });

  it("validates normalized category and subcategory uniqueness before writes", () => {
    assert.match(source, /normalizeInventoryName/);
    assert.match(source, /No se pueden crear categorías duplicadas/);
    assert.match(source, /No se pueden crear subcategorías duplicadas/);
    const saveStart = source.indexOf(
      "async function saveInventoryCategoriesAction",
    );
    const existingIndex = source.indexOf("const { data: existing }", saveStart);
    assert.ok(
      source.indexOf("const categoryNames = new Set<string>()", saveStart) <
        existingIndex,
    );
  });
});
