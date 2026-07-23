import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/133_fix_authoritative_guard_null_role.sql",
  ),
  "utf8",
);

describe("authoritative write guard administrative role handling", () => {
  it("bypasses only sessions that are distinct from authenticated", () => {
    const correctedPredicates = migration.match(
      /auth\.role\(\) is distinct from 'authenticated'/g,
    );
    assert.equal(correctedPredicates?.length, 2);
    assert.doesNotMatch(migration, /auth\.role\(\)\s*<>\s*'authenticated'/);
  });

  it("retains the application write rejection contracts", () => {
    assert.match(migration, /SHIPMENT_COMMAND_REQUIRED/);
    assert.match(migration, /SHIPMENT_AUTHORITATIVE_COLUMNS_COMMAND_REQUIRED/);
    assert.match(migration, /INVENTORY_MOVEMENT_COMMAND_REQUIRED/);
    assert.match(migration, /INVENTORY_STOCK_WITH_BALANCE_IMMUTABLE/);
  });
});
