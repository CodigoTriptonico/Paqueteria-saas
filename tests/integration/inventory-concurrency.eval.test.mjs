import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

const root = process.cwd();
const migrationSource = readFileSync(
  join(root, "supabase", "migrations", "047_production_security_hardening.sql"),
  "utf8",
);

describe("inventory atomic rpc concurrency guard", () => {
  it("uses row lock in salida path", () => {
    assert.match(migrationSource, /record_inventory_movement_atomic[\s\S]*for update/i);
    assert.match(migrationSource, /Stock insuficiente/);
  });
});
