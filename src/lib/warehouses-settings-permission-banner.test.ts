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

describe("warehouses settings permission banner", () => {
  it("waits for session before showing the no-permission message", () => {
    assert.match(panelSource, /const \[permissionsReady, setPermissionsReady\]/);
    assert.match(panelSource, /permissionsReady && !canManageWarehouses/);
    assert.match(panelSource, /initialCanManageWarehouses/);
    assert.match(
      inventarioSource,
      /WarehousesSettingsPanel initialCanManageWarehouses=\{canManageWarehouses\}/,
    );
  });
});
