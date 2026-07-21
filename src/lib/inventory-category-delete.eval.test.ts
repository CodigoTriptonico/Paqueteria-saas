import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const editorSource = readFileSync(
  join(root, "src/components/inventory-structure-editor.tsx"),
  "utf8",
);
const optionsMenuSource = readFileSync(
  join(root, "src/components/inventory/inventory-structure-options-menu.tsx"),
  "utf8",
);
const sidebarSource = readFileSync(
  join(root, "src/components/inventory/inventory-category-sidebar.tsx"),
  "utf8",
);

test("las dos entradas de borrado pasan por el mismo limpiador de estado", () => {
  assert.match(optionsMenuSource, /deleteCategory\(name\);/);
  assert.match(sidebarSource, /deleteCategory\(name\);/);

  const deleteIndex = editorSource.indexOf("function deleteCategory(name: string)");
  const optionsCloseIndex = editorSource.indexOf('setOptionsOpen(false);', deleteIndex);

  assert.ok(deleteIndex >= 0, "Falta el handler de borrado de categoría");
  assert.ok(optionsCloseIndex > deleteIndex, "El menú debe cerrarse al borrar");
  assert.ok(
    editorSource.indexOf('setEditingCategoryName("");', deleteIndex) < optionsCloseIndex,
    "El nombre temporal debe limpiarse antes de cerrar el menú",
  );
});
