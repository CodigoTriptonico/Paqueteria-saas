import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const migrationSource = readFileSync(
  join(process.cwd(), "supabase/migrations/107_inventory_entry_costs.sql"),
  "utf8",
);
const movementModalSource = readFileSync(
  join(process.cwd(), "src/components/inventory/inventory-item-context-menu.tsx"),
  "utf8",
);
const structureEditorSource = readFileSync(
  join(process.cwd(), "src/components/inventory-structure-editor.tsx"),
  "utf8",
);

describe("inventory entry cost eval", () => {
  it("stores movement costs and weighted average in the database layer", () => {
    assert.match(migrationSource, /avg_cost/);
    assert.match(migrationSource, /unit_cost/);
    assert.match(migrationSource, /total_cost/);
    assert.match(migrationSource, /p_unit_cost numeric default null/);
    assert.match(migrationSource, /next_avg_cost/);
  });

  it("exposes optional synced cost fields only on entrada", () => {
    assert.match(movementModalSource, /Costo total del lote/);
    assert.match(movementModalSource, /Costo unitario/);
    assert.match(movementModalSource, /movementDraft\.type === "entrada"/);
    assert.match(movementModalSource, /syncEntryCostFields/);
  });

  it("submits resolved entry costs from the inventory editor", () => {
    assert.match(structureEditorSource, /resolveEntryCostForSubmit/);
    assert.match(structureEditorSource, /unitCost:/);
    assert.match(structureEditorSource, /totalCost:/);
  });
});
