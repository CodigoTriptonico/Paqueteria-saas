import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

const root = process.cwd();
const migrationPath = join(root, "supabase", "migrations", "046_security_integrity_fixes.sql");
const migrationSource = readFileSync(migrationPath, "utf8");

describe("046 security integrity migration", () => {
  it("invoice counter checks caller org", () => {
    assert.match(migrationSource, /target_org_id is distinct from caller_org/);
  });

  it("invoice payment rpc validates payment amount", () => {
    assert.match(migrationSource, /payment_amount is null or payment_amount <= 0/);
    assert.match(migrationSource, /for update/);
    assert.match(migrationSource, /next_paid is distinct from current_paid \+ payment_amount/);
  });

  it("route stops policy scopes conductors to assigned routes", () => {
    assert.match(migrationSource, /logistics_route_stops_select/);
    assert.match(migrationSource, /current_role_slug\(\) <> 'conductor'/);
  });

  it("storage buckets are private", () => {
    assert.match(migrationSource, /set public = false/);
  });
});
