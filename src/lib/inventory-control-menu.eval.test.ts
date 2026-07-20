import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const source = readFileSync(
  join(process.cwd(), "src/components/inventory/inventory-control-menu.tsx"),
  "utf8",
);

describe("inventory control menu eval", () => {
  it("keeps custody, assignments and history inside one tracking drawer", () => {
    assert.match(source, /InventoryTrackingDrawer/);
    assert.match(source, /label="Custodia"/);
    assert.match(source, /InventoryToolbarIconButton/);
    assert.match(source, /controlledOpen/);
    assert.match(source, /truckBalances/);
    assert.match(source, /items={items}/);
    assert.match(source, /showDrawer/);
  });
});
