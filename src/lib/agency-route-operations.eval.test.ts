import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migration = readFileSync(join(root, "supabase/migrations/083_agency_route_operations.sql"), "utf8");
const validationMigration = readFileSync(join(root, "supabase/migrations/084_agency_request_catalog_validation.sql"), "utf8");
const agencyPanel = readFileSync(join(root, "src/components/business/agency-operations-panel.tsx"), "utf8");
const logistics = readFileSync(join(root, "src/components/logistica-client.tsx"), "utf8");
const conductor = readFileSync(join(root, "src/components/conductor/conductor-tareas-client.tsx"), "utf8");
const agenciesActions = readFileSync(join(root, "src/app/actions/agencies.ts"), "utf8");

test("agency operations connect requests, route stops and assigned drivers", () => {
  assert.match(migration, /agency_route_proposals/);
  assert.match(migration, /agency_visit_id uuid/);
  assert.match(migration, /assign_agency_request_to_route/);
  assert.match(migration, /complete_agency_visit_by_driver/);
  assert.match(migration, /route\.assigned_to = auth\.uid\(\)/);
  assert.match(validationMigration, /CAJA_DE_MATRIZ_INVALIDA/);
  assert.match(validationMigration, /item\.organization_id = agency_row\.matrix_organization_id/);
});

test("each operational surface keeps agencies visibly separate", () => {
  assert.match(agencyPanel, /Cajas de mi agencia/);
  assert.match(agencyPanel, /Solicitudes logísticas/);
  assert.match(logistics, /Domicilios/);
  assert.match(logistics, /Agencias/);
  assert.match(conductor, /AgencyVisitsPanel/);
  assert.match(agencyPanel, /Agregar otro servicio/);
  assert.match(agenciesActions, /reviewAgencyRouteProposalAction/);
});
