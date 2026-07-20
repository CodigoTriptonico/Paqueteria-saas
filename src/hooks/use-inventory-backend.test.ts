import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const hooksDir = dirname(fileURLToPath(import.meta.url));
const hookSource = readFileSync(join(hooksDir, "use-inventory-backend.ts"), "utf8");
const clientSource = readFileSync(
  join(hooksDir, "..", "components", "inventario-client.tsx"),
  "utf8",
);
const pageSource = readFileSync(
  join(hooksDir, "..", "app", "inventario", "page.tsx"),
  "utf8",
);

describe("inventory category persistence", () => {
  it("flushes category changes immediately instead of relying only on debounce", () => {
    assert.match(hookSource, /const persistCategoryConfigs = useCallback/);
    assert.match(hookSource, /categoryConfigsRef\.current = nextCategoryConfigs/);
    assert.match(hookSource, /await flushSaves\(\)/);
    assert.match(clientSource, /onCategoryConfigsChange=\{persistCategoryConfigs\}/);
  });

  it("does not expose category creation without a matching write permission", () => {
    assert.match(pageSource, /const canManageInventory =/);
    assert.match(pageSource, /sessionHasPermission\(session, "inventory.adjust"\)/);
    assert.match(clientSource, /showCategoryCreate=\{canManageInventory\}/);
    assert.match(clientSource, /showStructureDelete=\{canManageInventory\}/);
  });

  it("does not replace a failed initial inventory load with an empty snapshot", () => {
    assert.match(pageSource, /const initialData = inventoryResult\.ok/);
    assert.match(pageSource, /initialInventoryError=/);
    assert.match(clientSource, /if \(!loaded\)/);
    assert.match(clientSource, /return <PageLoading inline \/>/);
  });
});
