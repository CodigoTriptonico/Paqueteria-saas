import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const componentDir = dirname(fileURLToPath(import.meta.url));
const editorSource = readFileSync(
  join(componentDir, "..", "inventory-structure-editor.tsx"),
  "utf8",
);
const menuSource = readFileSync(
  join(componentDir, "inventory-structure-options-menu.tsx"),
  "utf8",
);

describe("inventory toolbar action separation eval", () => {
  it("keeps article, category, and subcategory creation as direct actions", () => {
    assert.match(editorSource, /label="Agregar artículo"/);
    assert.match(editorSource, /label="Nueva categoría"/);
    assert.match(editorSource, /label="Nueva subcategoría"/);
  });

  it("isolates destructive actions in the manage-structure menu", () => {
    assert.match(editorSource, /label="Gestionar estructura"/);
    assert.match(editorSource, /showStructureDelete && structureMenuMode === "manage"/);
    assert.match(menuSource, /showStructureDelete && mode === "manage"/);
  });
});
