import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const migrationSource = readFileSync(
  join(process.cwd(), "supabase/migrations/105_inventory_warehouse_transfers.sql"),
  "utf8",
);
const trackingDrawerSource = readFileSync(
  join(process.cwd(), "src/components/inventory/inventory-tracking-drawer.tsx"),
  "utf8",
);
const panelSource = readFileSync(
  join(process.cwd(), "src/components/inventory/inventory-transfers-panel.tsx"),
  "utf8",
);
const actionsSource = readFileSync(
  join(process.cwd(), "src/app/actions/inventory-transfers.ts"),
  "utf8",
);

describe("inventory warehouse transfers eval", () => {
  it("defines transfer lifecycle RPCs with origin and destination", () => {
    assert.match(migrationSource, /inventory_warehouse_transfers/);
    assert.match(migrationSource, /create_inventory_warehouse_transfer/);
    assert.match(migrationSource, /receive_inventory_warehouse_transfer/);
    assert.match(migrationSource, /cancel_inventory_warehouse_transfer/);
    assert.match(migrationSource, /from_warehouse_id/);
    assert.match(migrationSource, /to_warehouse_id/);
    assert.match(migrationSource, /warehouse_transfer_id/);
  });

  it("exposes transfers in the tracking drawer", () => {
    assert.match(trackingDrawerSource, /InventoryTransfersPanel/);
    assert.match(trackingDrawerSource, /"transfers"/);
  });

  it("supports create, receive and cancel actions in the panel", () => {
    assert.match(panelSource, /createInventoryWarehouseTransferAction/);
    assert.match(panelSource, /receiveInventoryWarehouseTransferAction/);
    assert.match(panelSource, /cancelInventoryWarehouseTransferAction/);
    assert.match(actionsSource, /create_inventory_warehouse_transfer/);
    assert.match(actionsSource, /receive_inventory_warehouse_transfer/);
    assert.match(actionsSource, /cancel_inventory_warehouse_transfer/);
  });
});
