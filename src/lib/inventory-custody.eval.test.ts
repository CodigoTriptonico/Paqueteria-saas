import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();

describe("inventory custody eval", () => {
  it("exposes custody inside the unified Seguimiento tracking drawer", () => {
    const menu = readFileSync(
      join(root, "src/components/inventory/inventory-control-menu.tsx"),
      "utf8",
    );
    const drawer = readFileSync(
      join(root, "src/components/inventory/inventory-tracking-drawer.tsx"),
      "utf8",
    );
    const action = readFileSync(
      join(root, "src/app/actions/inventory-custody.ts"),
      "utf8",
    );
    const lib = readFileSync(join(root, "src/lib/inventory-custody.ts"), "utf8");

    assert.match(menu, /InventoryTrackingDrawer/);
    assert.match(menu, /Seguimiento/);
    assert.match(drawer, /Custodia/);
    assert.match(drawer, /Asignaciones/);
    assert.match(drawer, /Historial/);
    assert.match(drawer, /Vacías/);
    assert.match(drawer, /Llenas/);
    assert.match(drawer, /loadInventoryCustodySnapshotAction/);
    assert.match(action, /inventory\.view/);
    assert.match(action, /agency_box_lot_balances/);
    assert.match(action, /shipment_packages/);
    assert.match(lib, /agencyAvailable/);
    assert.match(lib, /agencyAllocated/);
    assert.match(lib, /inTruck/);
  });

  it("keeps empty-box custody quantity-based and full-box custody status-based", () => {
    const lib = readFileSync(join(root, "src/lib/inventory-custody.ts"), "utf8");
    assert.match(lib, /buildEmptyBoxCustodyRows/);
    assert.match(lib, /buildFullBoxCustodyBuckets/);
    assert.match(lib, /PhysicalPackageStatus/);
    assert.doesNotMatch(lib, /barcode|serialNumber|expiry/);
  });
});
