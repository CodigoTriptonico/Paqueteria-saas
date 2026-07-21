import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function migration(name: string) {
  return readFileSync(path.join(root, "supabase", "migrations", name), "utf8");
}

test("restored migrations preserve the contracts used by customers and logistics", () => {
  assert.match(migration("051_customer_emails.sql"), /add column if not exists emails text\[\]/i);
  assert.match(migration("064_recipient_emails.sql"), /customer_recipients[\s\S]*emails text\[\]/i);
  assert.match(migration("052_address_verified.sql"), /warehouses[\s\S]*address_verified/i);
  assert.match(migration("053_logistics_v2.sql"), /'in_progress'/);
  assert.match(migration("056_logistics_weekly_route_catalog.sql"), /create table if not exists public\.logistics_route_templates/i);
  assert.match(migration("057_reload_logistics_route_catalog_schema.sql"), /route_template_id/i);
  assert.match(migration("058_logistics_schedule_confirmation.sql"), /schedule_confirmation_status/i);
  assert.match(migration("115_customer_route_verifications.sql"), /customer_route_assignment_requests/);
});
