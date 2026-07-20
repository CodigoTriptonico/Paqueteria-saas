import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const controlMenuSource = readFileSync(
  join(process.cwd(), "src/components/inventory/inventory-control-menu.tsx"),
  "utf8",
);
const trackingDrawerSource = readFileSync(
  join(process.cwd(), "src/components/inventory/inventory-tracking-drawer.tsx"),
  "utf8",
);
const custodyPanelSource = readFileSync(
  join(process.cwd(), "src/components/inventory/inventory-custody-panel.tsx"),
  "utf8",
);
const custodyLibSource = readFileSync(join(process.cwd(), "src/lib/inventory-custody.ts"), "utf8");
const custodyActionSource = readFileSync(
  join(process.cwd(), "src/app/actions/inventory-custody.ts"),
  "utf8",
);

describe("inventory custody eval", () => {
  it("exposes custody from inventory toolbar and keeps assignments/history inside one drawer", () => {
    assert.match(controlMenuSource, /label="Custodia"/);
    assert.match(controlMenuSource, /InventoryTrackingDrawer/);
    assert.match(trackingDrawerSource, /InventoryCustodyPanel/);
    assert.match(trackingDrawerSource, /InventoryAssignmentsDrawer/);
    assert.match(trackingDrawerSource, /InventoryMovementsDrawer/);
    assert.match(trackingDrawerSource, /id: "custody", label: "Dónde están"/);
  });

  it("aggregates empty and full custody buckets in deterministic code", () => {
    assert.match(custodyLibSource, /buildInventoryCustodyEmptyRows/);
    assert.match(custodyLibSource, /atAgencyAvailable/);
    assert.match(custodyLibSource, /onTruck/);
    assert.match(custodyLibSource, /buildInventoryCustodyFullCounts/);
    assert.match(custodyPanelSource, /Vacías/);
    assert.match(custodyPanelSource, /Llenas/);
    assert.match(custodyActionSource, /agency_box_lot_balances/);
    assert.match(custodyActionSource, /shipment_packages/);
    assert.match(custodyActionSource, /from\("organizations"\)/);
    assert.doesNotMatch(custodyActionSource, /agencies_organization_id_fkey/);
  });
});
