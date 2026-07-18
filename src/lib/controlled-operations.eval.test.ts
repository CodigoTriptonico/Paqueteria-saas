import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migration = readFileSync(join(root, "supabase/migrations/087_controlled_operations.sql"), "utf8");
const roleGrants = readFileSync(join(root, "supabase/migrations/088_controlled_operations_role_grants.sql"), "utf8");
const closeGuards = readFileSync(join(root, "supabase/migrations/089_agency_daily_close_guards.sql"), "utf8");
const idempotency = readFileSync(join(root, "supabase/migrations/090_controlled_operations_idempotency.sql"), "utf8");
const evidence = readFileSync(join(root, "supabase/migrations/091_controlled_operations_evidence_required.sql"), "utf8");

test("controlled operations are append-only and require a receiving party", () => {
  assert.match(migration, /package_custody_handoffs/);
  assert.match(migration, /package_custody_one_pending_idx/);
  assert.match(migration, /CUSTODY_RECEIVER_MUST_BE_DISTINCT/);
  assert.match(migration, /operational_exception_events/);
  assert.match(migration, /IMMUTABLE_CONTROLLED_OPERATION/);
  assert.match(roleGrants, /package\.custody\.receive/);
  assert.match(idempotency, /on conflict \(organization_id, idempotency_key\) do nothing/);
  assert.match(idempotency, /'replayed', true/);
  assert.match(evidence, /evidence <> '\{\}'::jsonb/);
});

test("daily close is two-person, immutable and agency-local", () => {
  assert.match(migration, /agency_daily_closures/);
  assert.match(migration, /AGENCY_REQUIRED/);
  assert.match(migration, /DAILY_CLOSE_FINALIZER_MUST_BE_DISTINCT/);
  assert.match(migration, /difference_cents bigint generated always/);
});

test("a finalized agency date rejects backdated sales and payments", () => {
  assert.match(closeGuards, /AGENCY_DAILY_CLOSE_LOCKED/);
  assert.match(closeGuards, /before insert on public\.sales/);
  assert.match(closeGuards, /before insert on public\.customer_payments/);
  assert.match(closeGuards, /before insert on public\.agency_payments/);
  assert.match(closeGuards, /received_at >= start_at/);
});
