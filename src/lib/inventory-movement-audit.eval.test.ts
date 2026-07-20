import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const migrationSource = readFileSync(
  join(process.cwd(), "supabase/migrations/106_inventory_movement_audit.sql"),
  "utf8",
);

describe("inventory movement audit eval", () => {
  it("adds custody-style audit columns and immutability", () => {
    assert.match(migrationSource, /reason_code/);
    assert.match(migrationSource, /from_location_type/);
    assert.match(migrationSource, /to_location_label/);
    assert.match(migrationSource, /reference_type/);
    assert.match(migrationSource, /evidence jsonb/);
    assert.match(migrationSource, /IMMUTABLE_INVENTORY_MOVEMENT/);
    assert.match(migrationSource, /movement_key/);
  });

  it("links sale fulfillment movements to shipments", () => {
    assert.match(migrationSource, /sale_fulfillment/);
    assert.match(migrationSource, /'shipment'/);
    assert.match(migrationSource, /sale-fulfill:/);
  });

  it("extends atomic movement rpc with audit params", () => {
    assert.match(migrationSource, /p_reason_code text default/);
    assert.match(migrationSource, /p_evidence jsonb default/);
  });
});
