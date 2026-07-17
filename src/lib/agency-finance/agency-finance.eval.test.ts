import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/071_agency_finance_accounting.sql"),
  "utf8",
);

test("una venta de agencia separa precio público, cargo interno y dinero del cliente", () => {
  assert.match(migration, /agency_price_list_lines/);
  assert.match(migration, /internal_rate_lines/);
  assert.match(migration, /insert into public\.customer_invoices/);
  assert.match(migration, /insert into public\.agency_charges/);
  assert.doesNotMatch(migration, /customer_payments[\s\S]{0,300}journal_entries/i);
});

test("un cobro de conductor para agencia crea pasivo y no ingreso de matriz", () => {
  assert.match(migration, /source_type = 'agency_customer_receivable'/);
  assert.match(migration, /'2100', 'Efectivo por pagar a agencias'/);
  assert.match(migration, /then '2100' else '1210'/);
});

test("reintentos no duplican ventas, pagos ni conciliaciones", () => {
  assert.match(migration, /unique \(tenant_id, idempotency_key\)/i);
  assert.match(migration, /finance_begin_operation/);
  for (const operation of ["create_agency_sale", "record_agency_payment", "reconcile_driver_settlement"]) {
    assert.match(migration, new RegExp(`finance_begin_operation\\(tenant_id_value, '${operation}'`));
  }
  assert.match(migration, /jsonb_set\(operation\.result, '\{replayed\}', 'true'/);
});

test("caja vacía es concepto de venta y nunca depósito", () => {
  const newSchema = migration.slice(migration.indexOf("create table public.internal_rate_lines"));
  assert.match(newSchema, /'empty_box'/);
  assert.doesNotMatch(newSchema, /empty_box_deposit/);
});
