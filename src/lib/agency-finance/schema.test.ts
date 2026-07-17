import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/071_agency_finance_accounting.sql"),
  "utf8",
);

test("el contrato financiero usa tenant, organización y centavos USD", () => {
  for (const table of [
    "sales",
    "customer_invoices",
    "agency_charges",
    "agency_payments",
    "journal_entries",
    "driver_settlements",
    "financial_holds",
  ]) {
    assert.match(migration, new RegExp(`create table public\\.${table} \\([\\s\\S]*?tenant_id uuid not null`, "i"));
  }
  assert.match(migration, /amount_cents bigint not null check \(amount_cents > 0\)/i);
  assert.match(migration, /currency text not null default 'USD' check \(currency = 'USD'\)/i);
});

test("asientos y eventos financieros quedan protegidos", () => {
  assert.match(migration, /create constraint trigger journal_entry_balance_guard[\s\S]*?deferrable initially deferred/i);
  assert.match(migration, /UNBALANCED_JOURNAL_ENTRY/);
  assert.match(migration, /IMMUTABLE_FINANCIAL_EVENT/);
  assert.match(migration, /agency_payment_application_reversals/);
  assert.match(migration, /finance_reverse_journal/);
});

test("la salida internacional no puede saltar una retención activa", () => {
  assert.match(migration, /before update of status on public\.shipment_packages/i);
  assert.match(migration, /new\.status = 'handed_to_carrier'/i);
  assert.match(migration, /FINANCIAL_HOLD_ACTIVE/);
  assert.match(migration, /financial_hold\.release_manual/);
  assert.match(migration, /SECOND_APPROVER_MUST_DIFFER/);
});

test("los RPC públicos derivan el tenant de sesión y devuelven el sobre común", () => {
  for (const rpc of [
    "create_agency_sale",
    "record_agency_payment",
    "reconcile_driver_settlement",
    "reverse_financial_event",
    "authorize_international_release",
  ]) {
    const body = migration.match(new RegExp(`create or replace function public\\.${rpc}\\([\\s\\S]*?\\n\\$\\$;`, "i"))?.[0];
    assert.ok(body, `falta ${rpc}`);
    assert.match(body, /public\.current_tenant_id\(\)/);
    assert.match(body, /operationId/);
    assert.match(body, /replayed/);
    assert.match(body, /'version', 1/);
    assert.match(body, /'entities'/);
  }
});

test("RLS consulta tenant y permiso con alcance", () => {
  assert.match(migration, /alter table public\.%I enable row level security/);
  assert.match(migration, /tenant_id = public\.current_tenant_id\(\)/);
  assert.match(migration, /current_membership_has_permission\('agency\.account\.view'/);
  assert.match(migration, /current_membership_has_permission\('accounting\.view'/);
});
