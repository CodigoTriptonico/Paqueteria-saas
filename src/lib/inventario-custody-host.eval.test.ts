import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const inventarioClientSource = readFileSync(
  join(process.cwd(), "src/components/inventario-client.tsx"),
  "utf8",
);

describe("inventario custody drawer host eval", () => {
  it("keeps the tracking drawer mounted outside the toolbar dropdown", () => {
    assert.match(inventarioClientSource, /showDrawer=\{false\}/);
    assert.match(inventarioClientSource, /<InventoryTrackingDrawer/);
    assert.match(inventarioClientSource, /trackingOpen=\{trackingOpen\}/);
    assert.match(inventarioClientSource, /onTrackingOpenChange=\{setTrackingOpen\}/);
  });
});
