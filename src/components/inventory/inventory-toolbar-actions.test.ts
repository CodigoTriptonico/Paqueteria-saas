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
const custodySource = readFileSync(
  join(componentDir, "inventory-control-menu.tsx"),
  "utf8",
);

describe("inventory toolbar actions", () => {
  it("keeps the primary add action separate from the tools panel", () => {
    assert.match(editorSource, /label="Agregar artículo"/);
    assert.match(editorSource, /label="Herramientas de inventario"/);
    assert.match(editorSource, /ariaHaspopup="menu"/);
    assert.match(editorSource, /w-\[min\(19rem,calc\(100vw-1rem\)\)\]/);
  });

  it("groups operational custody and catalog structure inside the panel", () => {
    assert.match(editorSource, /Operación/);
    assert.match(editorSource, /Catálogo/);
    assert.match(editorSource, /Categorías y subcategorías/);
    assert.match(editorSource, /Gestionar estructura/);
    assert.match(custodySource, /Quién tiene cada caja y sus movimientos/);
  });

  it("keeps category editing beside the selector and subcategories below it", () => {
    assert.match(editorSource, /icon=\{Pencil\}/);
    assert.match(editorSource, /label="Editar categor/);
    assert.match(editorSource, /className="flex min-w-0 flex-1 flex-col gap-1\.5"/);
    assert.match(editorSource, /className="min-w-0 w-full"/);
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
