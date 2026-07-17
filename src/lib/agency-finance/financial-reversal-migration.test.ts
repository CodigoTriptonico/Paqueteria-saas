import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration071 = readFileSync(
  join(process.cwd(), "supabase/migrations/071_agency_finance_accounting.sql"),
  "utf8",
);
const migration074 = readFileSync(
  join(process.cwd(), "supabase/migrations/074_financial_reversal_completion.sql"),
  "utf8",
);

function rpcBody(source: string): string {
  const body = source.match(
    /create or replace function public\.reverse_financial_event\(command jsonb, idempotency_key text\)[\s\S]*?\n\$\$;/i,
  )?.[0];
  assert.ok(body, "falta reverse_financial_event");
  return body.replaceAll("\r\n", "\n").trim();
}

test("074 reproduce exactamente la definición final de reversos de 071", () => {
  assert.equal(rpcBody(migration074), rpcBody(migration071));
});

test("el RPC final cubre cada hecho financiero reversible", () => {
  const body = rpcBody(migration074);
  for (const target of ["charge", "credit", "adjustment", "payment", "customer_payment", "driver_settlement"]) {
    assert.match(body, new RegExp(`target_type_value = '${target}'`));
  }
  assert.match(body, /finance_reverse_journal\('driver_settlement'/);
  assert.match(body, /finance_sync_hold_for_charge\(credit_row\.charge_id/);
  assert.match(body, /REVERSE_CHILD_EVENTS_FIRST/);
});

test("074 conserva ejecución solo para usuarios autenticados", () => {
  assert.match(migration074, /revoke execute on function public\.reverse_financial_event\(jsonb, text\) from public/i);
  assert.match(migration074, /grant execute on function public\.reverse_financial_event\(jsonb, text\) to authenticated/i);
});
