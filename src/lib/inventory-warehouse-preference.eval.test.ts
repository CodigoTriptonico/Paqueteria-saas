import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const panelSource = readFileSync(
  join(root, "src/components/config/warehouses-settings-panel.tsx"),
  "utf8",
);
const inventarioSource = readFileSync(
  join(root, "src/components/inventario-client.tsx"),
  "utf8",
);
const warehousesActionSource = readFileSync(
  join(root, "src/app/actions/warehouses.ts"),
  "utf8",
);
const barSource = readFileSync(
  join(root, "src/components/inventory-warehouse-bar.tsx"),
  "utf8",
);

describe("inventory warehouse choice without org toggle", () => {
  it("removes the inventory selector toggle from warehouse settings", () => {
    assert.doesNotMatch(panelSource, /Selector en Inventario|Elegir bodega en Inventario/);
    assert.doesNotMatch(panelSource, /multiWarehouseEnabled/);
    assert.doesNotMatch(panelSource, /ToggleSwitch/);
    assert.doesNotMatch(panelSource, /Inventario recuerda la última bodega/);
    assert.doesNotMatch(
      panelSource,
      /border-amber-500\/40[\s\S]{0,400}Bodega principal/,
    );
    assert.doesNotMatch(panelSource, /Settings2[\s\S]{0,200}Opciones/);
    assert.doesNotMatch(panelSource, /Elegir bodega principal|Sincronizar catálogo/);
    assert.match(panelSource, /Bodega principal/);
  });

  it("lets inventario switch warehouses and remembers the choice", () => {
    assert.match(inventarioSource, /rememberPreferredWarehouseAction/);
    assert.match(inventarioSource, /selectWarehouse/);
    assert.doesNotMatch(inventarioSource, /modo múltiples bodegas/);
    assert.match(warehousesActionSource, /export async function rememberPreferredWarehouseAction/);
    assert.match(warehousesActionSource, /default_warehouse_id/);
    assert.match(barSource, /warehouses\.length === 1/);
  });

  it("opens warehouse creation in a dedicated modal", () => {
    assert.match(panelSource, /CreateWarehouseModal/);
    assert.match(panelSource, /Nueva bodega/);
    assert.doesNotMatch(panelSource, /placeholder="Nueva bodega"/);
    assert.match(
      readFileSync(join(root, "src/components/config/create-warehouse-modal.tsx"), "utf8"),
      /app-modal-overlay/,
    );
  });

  it("does not flash the no-permission banner before session is known", () => {
    assert.match(panelSource, /permissionsReady && !canManageWarehouses/);
    assert.match(panelSource, /initialCanManageWarehouses/);
    assert.match(panelSource, /setPermissionsReady\(true\)/);
    assert.match(
      inventarioSource,
      /WarehousesSettingsPanel initialCanManageWarehouses=\{canManageWarehouses\}/,
    );
    assert.doesNotMatch(
      panelSource,
      /\{!canManageWarehouses \? \(\s*<p className="rounded-xl border border-black bg-surface-card/,
    );
  });
});
