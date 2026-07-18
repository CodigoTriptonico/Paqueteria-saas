import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const migration = readFileSync(join(root, "supabase/migrations/085_agency_rate_administration.sql"), "utf8");
const panel = readFileSync(join(root, "src/components/business/agency-rate-admin-panel.tsx"), "utf8");

test("la administración tarifa cada agencia contra el catálogo real y conserva el historial", () => {
  assert.match(migration, /save_agency_internal_rates/i);
  assert.match(migration, /pricing_country_boxes/i);
  assert.match(migration, /internal_rate_versions/i);
  assert.match(migration, /status = 'retired'/i);
  assert.match(migration, /agency\.pricing\.manage/i);
});

test("el panel explica que el monto es la cuenta por cobrar de la matriz", () => {
  assert.match(panel, /paga a la matriz por cada caja/i);
  assert.match(panel, /Saldo pendiente/i);
  assert.match(panel, /Guardar tarifas/i);
});
