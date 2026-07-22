import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const contextMenuSource = readFileSync(
  join(process.cwd(), "src/components/inventory/inventory-item-context-menu.tsx"),
  "utf8",
);
const placementDrawerSource = readFileSync(
  join(process.cwd(), "src/components/inventory/inventory-bin-placement-drawer.tsx"),
  "utf8",
);
const binsPanelSource = readFileSync(
  join(process.cwd(), "src/components/config/warehouse-bins-panel.tsx"),
  "utf8",
);
const createBinModalSource = readFileSync(
  join(process.cwd(), "src/components/config/create-warehouse-bin-modal.tsx"),
  "utf8",
);
const actionsSource = readFileSync(
  join(process.cwd(), "src/app/actions/inventory-bins.ts"),
  "utf8",
);

describe("inventory bins eval", () => {
  it("exposes shelf placement from the item context menu and settings panel", () => {
    assert.match(contextMenuSource, /Ubicación en bodega/);
    assert.match(contextMenuSource, /onOpenBinPlacement/);
    assert.match(placementDrawerSource, /InventoryBinPlacementDrawer/);
    assert.match(placementDrawerSource, /setInventoryBinPlacementAction/);
    assert.match(binsPanelSource, /WarehouseBinsPanel/);
    assert.match(binsPanelSource, /Zonas y estantes/);
    assert.match(binsPanelSource, /CreateWarehouseBinModal/);
    assert.match(createBinModalSource, /app-modal-overlay/);
    assert.match(createBinModalSource, /Nuevo estante/);
    assert.match(
      createBinModalSource,
      /w-full min-w-0 text-center[\s\S]*size=\{1\}/,
    );
    assert.match(createBinModalSource, /grid min-w-0 gap-1\.5/);
    assert.doesNotMatch(binsPanelSource, /rounded-xl border border-black bg-surface-inset\/40 p-3/);
    assert.match(actionsSource, /listWarehouseBinsAction/);
    assert.match(actionsSource, /validateBinPlacementQuantity/);
  });
});
