import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function component(path: string) {
  return readFileSync(new URL(`../components/${path}`, import.meta.url), "utf8");
}

const modules = [
  "commercial/commercial-admin-client.tsx",
  "conductor/agency-visits-panel.tsx",
  "config/appearance-settings-panel.tsx",
  "config/plan-settings-panel.tsx",
  "config/promotion-sortable-list.tsx",
  "config/roles-permissions-panel.tsx",
  "config/user-warehouse-access-editor.tsx",
  "distribution/distribution-workspace.tsx",
  "inventory/inventory-truck-panel.tsx",
  "logistica/agency-logistics-panel.tsx",
  "platform/platform-console.tsx",
  "platform/platform-create-client-wizard.tsx",
];

describe("visual density cleanup eval", () => {
  it("reuses the same contextual help component across product areas", () => {
    for (const path of modules) {
      assert.match(
        component(path),
        /CompactInfoDisclosure/,
        `${path} must use the shared disclosure`,
      );
    }
  });

  it("keeps the current Boxario palette and typography vocabulary", () => {
    const combined = modules.map(component).join("\n");
    assert.match(combined, /bg-surface-(?:card|inset|base)/);
    assert.match(combined, /text-emerald-(?:100|200|300|400)/);
    assert.match(combined, /font-black/);
    assert.doesNotMatch(combined, /\bbg-gray-|\btext-gray-900|\bfont-serif/);
  });

  it("does not replace labels with placeholders", () => {
    const access = component("config/user-warehouse-access-editor.tsx");
    const plan = component("config/plan-settings-panel.tsx");
    assert.match(access, /Bodega favorita/);
    assert.match(plan, /Módulo Agencias/);
    assert.match(plan, /Límites del plan/);
  });
});
