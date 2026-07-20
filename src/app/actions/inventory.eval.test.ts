import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const actionsDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(actionsDir, "inventory.ts"), "utf8");

describe("inventory deletion safety eval", () => {
  it("keeps audit-linked items and blocks destructive category cascades", () => {
    assert.match(source, /createSupabaseAdminClient\(\)/);
    assert.match(source, /inventory_movements/);
    assert.match(source, /inventory_assignments/);
    assert.match(source, /assertCategoryDeletionDoesNotBreakHistory/);
    assert.match(source, /A manager may no longer have access/);
  });

  it("rejects duplicate category hierarchy names before persistence", () => {
    assert.match(source, /const categoryNames = new Set<string>\(\)/);
    assert.match(source, /const subcategoryNames = new Set<string>\(\)/);
    assert.match(source, /normalizeInventoryName\(category.name\)/);
    assert.match(source, /normalizeInventoryName\(subcategory.name\)/);
    assert.match(source, /No se pueden crear categorías duplicadas/);
    assert.match(source, /No se pueden crear subcategorías duplicadas/);
  });
});
