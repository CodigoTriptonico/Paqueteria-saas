import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = readFileSync(
  join(process.cwd(), "src/components/inventory-structure-editor.tsx"),
  "utf8",
);
const deleteCategoryBody = source.match(
  /function deleteCategory\(name: string\) \{([\s\S]*?)\n  \}\n\n  function addSubcategory/,
)?.[1];

test("borrar una categoría limpia el editor que estaba abierto", () => {
  assert.ok(deleteCategoryBody, "No se encontró deleteCategory");
  for (const reset of [
    'setEditingCategory("")',
    'setEditingCategoryName("")',
    'setEditingSubcategoryId("")',
    'setEditingSubcategoryName("")',
    'setOpenSubcategoryInput("")',
    "setShowNewCategoryInput(false)",
    "setShowNewItemForm(false)",
    "setOptionsOpen(false)",
  ]) {
    assert.match(deleteCategoryBody, new RegExp(reset.replace(/[()]/g, "\\$&")));
  }
});
