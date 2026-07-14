import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

test("distribution sales keep public price out of the matrix receivable", () => {
  const source = readFileSync(join(root, "supabase/migrations/065_distribution_partners.sql"), "utf8");
  assert.match(source, /'charge', offer\.wholesale_price/);
  assert.match(source, /distributor_public_price/);
  assert.doesNotMatch(source, /'charge', offer\.public_price/);
});

test("distribution sales enforce credit and reverse a voided shipment", () => {
  const source = readFileSync(join(root, "supabase/migrations/065_distribution_partners.sql"), "utf8");
  assert.match(source, /Limite de credito alcanzado/);
  assert.match(source, /distribution_reverse_voided_shipment/);
});

test("distribution balances reject unrelated organizations", () => {
  const source = readFileSync(join(root, "supabase/migrations/066_distribution_partner_balance_guard.sql"), "utf8");
  assert.match(source, /current_organization_id\(\) not in/);
  assert.match(source, /raise exception 'FORBIDDEN'/);
});
