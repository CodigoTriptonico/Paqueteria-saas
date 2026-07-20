import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const shipmentsSource = readFileSync(join(root, "src/app/actions/shipments.ts"), "utf8");
const migrationSource = readFileSync(
  join(root, "supabase/migrations/102_inventory_sale_reservations.sql"),
  "utf8",
);

describe("inventory sale reservation eval", () => {
  it("reserves empty-box stock when a sale is created", () => {
    assert.match(shipmentsSource, /reserveEmptyBoxStockForShipment/);
    assert.match(shipmentsSource, /shouldReserveEmptyBoxStockOnSale/);
    assert.match(shipmentsSource, /reserveInventorySaleStock/);
  });

  it("fulfills reservations instead of only direct salidas on handoff", () => {
    assert.match(shipmentsSource, /fulfillInventorySaleStock/);
    assert.match(shipmentsSource, /deductEmptyBoxStockLegacySalida/);
  });

  it("releases active reservations when a shipment rollback deletes the sale", () => {
    assert.match(shipmentsSource, /releaseInventorySaleStock/);
  });

  it("defines atomic reserve, fulfill and release RPCs", () => {
    assert.match(migrationSource, /reserve_inventory_sale_stock/);
    assert.match(migrationSource, /fulfill_inventory_sale_stock/);
    assert.match(migrationSource, /release_inventory_sale_stock/);
    assert.match(migrationSource, /inventory_sale_reservations/);
  });
});
