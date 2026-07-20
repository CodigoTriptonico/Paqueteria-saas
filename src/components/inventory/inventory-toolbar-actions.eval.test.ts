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
  it("keeps article creation primary and secondary inventory work in one menu", () => {
    assert.match(editorSource, /label="Agregar artículo"/);
    assert.match(editorSource, /label="Más acciones de inventario"/);
    assert.match(editorSource, /Categorías y subcategorías/);
    assert.doesNotMatch(editorSource, /Ver tarjetas/);
    assert.doesNotMatch(editorSource, /Ver lista/);
    assert.match(menuSource, /Nueva categoría/);
    assert.match(menuSource, /Nueva subcategoría/);
    assert.doesNotMatch(menuSource, /Nuevo item/);
  });

  it("isolates destructive actions in the manage-structure menu", () => {
    assert.match(editorSource, /Gestionar estructura/);
    assert.match(editorSource, /showStructureDelete && structureMenuMode === "manage"/);
    assert.match(menuSource, /showStructureDelete && mode === "manage"/);
  });
});
