import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const editorSource = readFileSync(join(root, "components/inventory-structure-editor.tsx"), "utf8");
const gridSource = readFileSync(join(root, "components/inventory/inventory-item-grid.tsx"), "utf8");

describe("inventario view layout eval", () => {
  it("uses the shared sidebar preference for inventory view layout", () => {
    assert.equal(editorSource.includes("usePageViewLayout"), true);
    assert.equal(editorSource.includes('usePageViewLayout("inventory.items")'), true);
    assert.equal(editorSource.includes("toggleViewLayout()"), false);
    assert.equal(editorSource.includes("Ver tarjetas"), false);
    assert.equal(editorSource.includes("Ver lista"), false);
  });

  it("keeps inventario toolbar controls left and metrics on the right in one row", () => {
    assert.equal(editorSource.includes('className="flex shrink-0 overflow-hidden rounded-xl border border-black bg-[#17201d]"'), true);
    assert.match(editorSource, /inventoryToolbarRowClass/);
    assert.match(editorSource, /inventoryToolbarCatalogGroupClass/);
  });

  it("renders row and card inventory item lists", () => {
    assert.equal(gridSource.includes('viewLayout === "rows"'), true);
    assert.equal(gridSource.includes("InventoryItemRow"), true);
    assert.equal(gridSource.includes("InventoryItemCard"), true);
  });
});
