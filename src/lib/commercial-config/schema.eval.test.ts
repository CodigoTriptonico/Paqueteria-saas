import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/094_commercial_configuration_inheritance.sql"), "utf8");
const adminUi = readFileSync(join(process.cwd(), "src/components/commercial/commercial-admin-client.tsx"), "utf8");
const logisticsUi = readFileSync(join(process.cwd(), "src/components/logistica/agency-logistics-panel.tsx"), "utf8");
const driverUi = readFileSync(join(process.cwd(), "src/components/conductor/agency-visits-panel.tsx"), "utf8");
const documentation = readFileSync(join(process.cwd(), "docs/commercial-logistics-separation.md"), "utf8");

describe("commercial separation eval", () => {
  it("makes inheritance and restoration legible without mixing balances", () => {
    assert.match(adminUi, /País.*Grupo.*Entidad/s);
    assert.match(adminUi, /Volver a heredar/);
    assert.match(adminUi, /Precios sugeridos/);
    assert.match(adminUi, /Tarifas internas/);
    assert.doesNotMatch(adminUi, /Saldo pendiente|Registrar pago|Cobrar/);
  });

  it("keeps logistics operational and visibly source-separated", () => {
    assert.match(logisticsUi, /Oficina de agencia/);
    assert.match(logisticsUi, /Cliente de agencia/);
    assert.doesNotMatch(logisticsUi, /saveCommercialOverride|precio público|Tarifa interna/);
    assert.match(driverUi, /Solo movimientos físicos/);
    assert.doesNotMatch(driverUi, /PAYMENT_METHOD_OPTIONS|Cobros pendientes/);
  });

  it("leaves a future geographic pricing extension point", () => {
    assert.match(migration, /calculation_rule jsonb/);
    assert.match(migration, /\{"type":"fixed"\}/);
  });

  it("documents ownership, precedence, snapshots and restart-safe migrations", () => {
    assert.match(documentation, /Excepción individual[\s\S]*Excepción general[\s\S]*Base del país/);
    assert.match(documentation, /Fotografías históricas de precio/);
    assert.match(documentation, /no elimina ni reescribe hechos financieros históricos/);
  });
});
