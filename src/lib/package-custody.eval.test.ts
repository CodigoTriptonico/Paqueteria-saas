import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/092_package_custody_timeline.sql"), "utf8");
const insertFix = readFileSync(
  join(process.cwd(), "supabase/migrations/114_fix_package_custody_insert_previous_holder.sql"),
  "utf8",
);

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

test("sale invoice package inserts never touch an unassigned previous_holder record", () => {
  const fnStart = insertFix.indexOf("create or replace function public.record_package_custody_status_event()");
  assert.ok(fnStart >= 0);
  const fnBody = insertFix.slice(fnStart);
  assert.match(insertFix, /record "previous_holder" is not assigned yet/);
  assert.match(fnBody, /from_holder_type_value := null/);
  assert.match(fnBody, /from_holder_type_value, from_holder_id_value, from_holder_label_value/);
  assert.equal(/else previous_holder\./.test(fnBody), false);
  assert.match(insertFix, /return query select 'cliente'::text[\s\S]*?return;/);
  assert.match(fnBody, /select \* into strict next_holder/);
});
