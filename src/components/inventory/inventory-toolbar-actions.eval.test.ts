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
  it("keeps article creation primary and operational work in the overflow menu", () => {
    assert.match(editorSource, /label="Agregar artículo"/);
    assert.match(editorSource, /label="Operación de inventario"/);
    assert.match(editorSource, /aria-label="Operación de inventario"/);
    assert.match(editorSource, /\{toolbarEndSlot\}/);
    assert.doesNotMatch(editorSource, /Ver tarjetas/);
    assert.doesNotMatch(editorSource, /Ver lista/);
    assert.match(menuSource, /Nueva categoría/);
    assert.match(menuSource, /Nueva subcategoría/);
    assert.doesNotMatch(menuSource, /Nuevo item/);
  });

  it("isolates destructive structure actions in the pencil popover", () => {
    assert.match(editorSource, /icon=\{Pencil\}/);
    assert.match(menuSource, /deleteIconButtonClass/);
    assert.match(menuSource, /onClick=\{confirmDeleteCategory\}/);
    assert.match(menuSource, /onBlur=\{\(\) => saveCategory\(selectedCategoryData\.name\)\}/);
    assert.match(menuSource, /Renombrar categoría/);
    assert.doesNotMatch(menuSource, /Guardar nombre/);
    assert.doesNotMatch(menuSource, />\s*Eliminar categoría\s*<\/button>/);
  });

  it("makes the category hierarchy visible in the compact toolbar", () => {
    assert.match(editorSource, /embeddedSubcategoryOptions\.length > 1/);
    assert.match(editorSource, /placeholder="Subcategor/);
    assert.match(editorSource, /embeddedSubcategoryOpen/);
    assert.match(editorSource, /inventoryToolbarSubcategoryPickerWidthClass/);
    assert.match(editorSource, /ChevronRight/);
  });

  it("keeps duplicate names out of the client structure editor", () => {
    assert.match(editorSource, /categoryNames\.includes\(normalizedName\)/);
    assert.match(editorSource, /inventoryTreeItemExists\(categoryItems\(categoryData\)/);
    assert.match(editorSource, /Ya existe una categoría con ese nombre/);
  });
});
