import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const migration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "126_protect_organization_plan_settings.sql"),
  "utf8",
);

describe("organization plan settings guard gate", () => {
  it("ships the entitlement restore paths for all three locked keys", () => {
    assert.match(migration, /jsonb_set\(new_settings, '\{max_users\}'/);
    assert.match(migration, /jsonb_set\(new_settings, '\{max_warehouses\}'/);
    assert.match(migration, /jsonb_set\(new_settings, '\{agencies_enabled\}'/);
    assert.match(migration, /new_settings - 'max_users'/);
    assert.match(migration, /new_settings - 'max_warehouses'/);
    assert.match(migration, /new_settings - 'agencies_enabled'/);
  });
});
