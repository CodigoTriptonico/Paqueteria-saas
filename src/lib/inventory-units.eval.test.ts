import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const inventoryActionSource = readFileSync(
  join(root, "src/app/actions/inventory.ts"),
  "utf8",
);
const gridSource = readFileSync(
  join(root, "src/components/inventory/inventory-item-grid.tsx"),
  "utf8",
);
const contextMenuSource = readFileSync(
  join(root, "src/components/inventory/inventory-item-context-menu.tsx"),
  "utf8",
);

describe("inventory units eval", () => {
  it("exposes unit update action and renders unit labels in inventory UI", () => {
    assert.match(inventoryActionSource, /updateInventoryItemUnitAction/);
    assert.match(gridSource, /formatInventoryStockLabel/);
    assert.match(contextMenuSource, /Unidad de medida/);
  });
});
