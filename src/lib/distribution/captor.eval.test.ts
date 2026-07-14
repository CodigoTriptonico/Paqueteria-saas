import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const migration = fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/067_distribution_acquisition_owners.sql"), "utf8");
const stats = fs.readFileSync(path.resolve(process.cwd(), "src/components/estadisticas-client.tsx"), "utf8");

test("captor ownership and sale snapshot are durable database contracts", () => {
  assert.match(migration, /acquisition_owner_id uuid/);
  assert.match(migration, /distribution_acquisition_owner_id uuid/);
  assert.match(migration, /distribution_partner_owner_history/);
  assert.match(migration, /distribution_assign_acquisition_owner/);
});

test("statistics expose sellers and distributors as separate tabs", () => {
  assert.match(stats, />Vendedores</);
  assert.match(stats, />Distribuidores</);
  assert.match(stats, /DistribuidoresPanel/);
});
