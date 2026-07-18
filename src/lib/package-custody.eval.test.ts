import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/092_package_custody_timeline.sql"), "utf8");

test("every physical package state writes an immutable custody timeline", () => {
  assert.match(migration, /create table if not exists public\.package_custody_events/);
  assert.match(migration, /after insert or update of status, truck_route_id, pallet_id, provider_name on public\.shipment_packages/);
  assert.match(migration, /IMMUTABLE_PACKAGE_CUSTODY_EVENT/);
  for (const state of ["in_truck", "pending_intake", "warehouse_intake", "in_warehouse", "on_pallet", "handed_to_carrier"]) {
    assert.match(migration, new RegExp(`when '${state}'`));
  }
});

test("manual receipts and existing physical boxes join the same custody history", () => {
  assert.match(migration, /'manual_handoff'/);
  assert.match(migration, /Estado físico existente al activar la cadena de custodia/);
  assert.match(migration, /create or replace view public\.package_custody_current/);
});
