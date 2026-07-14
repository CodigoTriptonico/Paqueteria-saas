import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const source = readFileSync(
  join(process.cwd(), "src/components/inventory/inventory-control-menu.tsx"),
  "utf8",
);

describe("inventory control menu eval", () => {
  it("keeps assignment and history tools compact while their details stay in drawers", () => {
    assert.match(source, /InventoryAssignmentsDrawer/);
    assert.match(source, /InventoryMovementsDrawer/);
    assert.match(source, /hideTrigger/);
    assert.match(source, /InventoryToolbarIconButton/);
    assert.match(source, /controlledOpen/);
  });
});
