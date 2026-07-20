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
const custodySource = readFileSync(
  join(componentDir, "inventory-control-menu.tsx"),
  "utf8",
);

describe("inventory toolbar actions", () => {
  it("keeps the primary add action separate from the operation menu", () => {
    assert.match(editorSource, /label="Agregar artículo"/);
    assert.match(editorSource, /label="Operación de inventario"/);
    assert.match(editorSource, /ariaHaspopup="menu"/);
    assert.match(editorSource, /w-\[min\(19rem,calc\(100vw-1rem\)\)\]/);
  });

  it("routes catalog structure through the pencil and custody through the menu", () => {
    assert.match(editorSource, /icon=\{Pencil\}/);
    assert.match(editorSource, /Editar categorías y subcategorías/);
    assert.match(editorSource, /openStructureMenu\(event\.currentTarget, "create"\)/);
    assert.doesNotMatch(editorSource, /Categorías y subcategorías/);
    assert.doesNotMatch(editorSource, /Gestionar estructura/);
    assert.doesNotMatch(editorSource, /Herramientas de inventario/);
    assert.doesNotMatch(editorSource, /Control operativo y organización del catálogo/);
    assert.match(menuSource, /Renombrar categoría/);
    assert.match(custodySource, /Quién tiene cada caja y sus movimientos/);
  });

  it("keeps category pickers compact beside the pencil", () => {
    assert.match(editorSource, /inventoryToolbarCatalogGroupClass/);
    assert.match(editorSource, /inventoryToolbarPickerShellClass/);
    assert.match(editorSource, /showEmbeddedSubcategoryPicker/);
    assert.match(editorSource, /inventoryToolbarChevronButtonClass/);
  });

  it("blocks duplicate category names in the client before persisting", () => {
    assert.match(editorSource, /categoryNames\.includes\(normalizedName\)/);
    assert.match(
      editorSource,
      /inventoryTreeItemExists\(categoryItems\(categoryData\), subcategoryName\)/,
    );
    assert.match(editorSource, /Ya existe una subcategoría con ese nombre aquí/);
  });
});
