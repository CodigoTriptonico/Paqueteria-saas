import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const migration = readFileSync(join(root, "supabase/migrations/085_agency_rate_administration.sql"), "utf8");
const publicPricesMigration = readFileSync(join(root, "supabase/migrations/086_agency_public_price_workspace.sql"), "utf8");
const panel = readFileSync(join(root, "src/components/commercial/commercial-admin-client.tsx"), "utf8");
const publicPanel = readFileSync(join(root, "src/components/business/agency-public-price-panel.tsx"), "utf8");

test("la administración tarifa cada agencia contra el catálogo real y conserva el historial", () => {
  assert.match(migration, /save_agency_internal_rates/i);
  assert.match(migration, /pricing_country_boxes/i);
  assert.match(migration, /internal_rate_versions/i);
  assert.match(migration, /status = 'retired'/i);
  assert.match(migration, /agency\.pricing\.manage/i);
});

test("el panel integra la tarifa interna sin mezclar saldos ni pagos", () => {
  assert.match(panel, /Tarifas internas de la matriz/i);
  assert.match(panel, /No representa saldos ni pagos/i);
  assert.match(panel, /Volver a heredar/i);
  assert.doesNotMatch(panel, /Saldo pendiente/i);
});

test("la agencia ve su tarifa interna, controla solo su precio público y calcula margen", () => {
  assert.match(publicPricesMigration, /load_agency_public_price_workspace/i);
  assert.match(publicPricesMigration, /save_agency_public_prices/i);
  assert.match(publicPricesMigration, /internal_rate_lines/i);
  assert.match(publicPricesMigration, /agency_price_list_lines/i);
  assert.match(publicPricesMigration, /agency\.pricing\.manage/i);
  assert.match(publicPanel, /La matriz recibe/i);
  assert.match(publicPanel, /Ganancia por caja/i);
  assert.match(publicPanel, /Precio al público/i);
});
