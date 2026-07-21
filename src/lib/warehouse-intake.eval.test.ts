import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync("src/components/warehouse/warehouse-intake-client.tsx", "utf8");
const actions = readFileSync("src/app/actions/warehouse-intake.ts", "utf8");
const page = readFileSync("src/app/ingreso-bodega/page.tsx", "utf8");
const migration = readFileSync("supabase/migrations/117_warehouse_intake_sessions.sql", "utf8");
const arrivalMigration = readFileSync("supabase/migrations/120_conductor_route_arrival.sql", "utf8");
const custodyOrderingMigration = readFileSync("supabase/migrations/122_fix_current_custody_same_timestamp.sql", "utf8");
const foundIntakeMigration = readFileSync("supabase/migrations/123_found_warehouse_intake.sql", "utf8");

test("warehouse intake is a formal manifest with atomic, idempotent scans", () => {
  assert.match(migration, /warehouse_intake_sessions/);
  assert.match(migration, /warehouse_intake_expected_packages/);
  assert.match(migration, /warehouse_intake_items/);
  assert.match(migration, /warehouse_intake_events/);
  assert.match(migration, /for update/);
  assert.match(migration, /unique \(organization_id, operation_key\)/);
  assert.match(migration, /PACKAGE_ALREADY_SCANNED/);
  assert.match(migration, /WAREHOUSE_INTAKE_RECORDS_ARE_APPEND_ONLY/);
  assert.match(actions, /scan_warehouse_intake_package/);
  assert.doesNotMatch(actions, /\.update\(\{[\s\S]*status:\s*"warehouse_intake"/);
});

test("custody moves only on accepted scan and route arrival is connected", () => {
  assert.match(migration, /status = 'warehouse_intake'/);
  assert.match(migration, /intake_recorded_by = auth\.uid\(\)/);
  assert.match(migration, /effective_status in \('in_truck', 'pending_intake'\)/);
  assert.match(migration, /mark_collected_packages_in_truck/);
  assert.match(migration, /mark_route_packages_arrived/);
  assert.match(migration, /warehouse_location_label/);
  assert.match(arrivalMigration, /arrival_warehouse_id/);
  assert.match(arrivalMigration, /ARRIVAL_WAREHOUSE_MISMATCH/);
  assert.match(component, /Descargar en/);
  assert.match(component, /Motivo: \{truck\.arrivalReason\}/);
  assert.match(custodyOrderingMigration, /event\.package_status = package\.status/);
});

test("mobile intake keeps scan first, supports Enter and stable overlay details", () => {
  assert.match(component, /Escanear y aceptar custodia/);
  assert.match(component, /event\.key === "Enter"/);
  assert.match(component, /requestAnimationFrame\(\(\) => codeRef\.current\?\.focus\(\)\)/);
  assert.match(component, /fixed inset-0 z-\[145\]/);
  assert.match(component, /capture="environment"/);
  assert.match(component, /pb-24/);
  assert.match(component, /disabled:opacity-40/);
  assert.match(page, /getWarehouseIntakeWorkspaceAction/);
});

test("damage, unknown boxes, reconciliation and audited reopening stay reachable", () => {
  assert.match(component, /Registrar sin identificar/);
  assert.match(component, /La caja quedará en Cuarentena/);
  assert.match(component, /El conductor confirma la entrega/);
  assert.match(component, /Confirmo como encargado de bodega/);
  assert.match(component, /completed_with_exceptions/);
  assert.match(actions, /reopen_warehouse_intake/);
  assert.match(migration, /EXCEPTION_EVIDENCE_REQUIRED/);
  assert.match(migration, /DRIVER_CONFIRMATION_OR_NOTE_REQUIRED/);
});

test("a found box enters without a truck while keeping its source uncertainty traceable", () => {
  assert.match(foundIntakeMigration, /open_found_warehouse_intake/);
  assert.match(foundIntakeMigration, /scan_found_warehouse_intake_package/);
  assert.match(foundIntakeMigration, /route_id drop not null/);
  assert.match(foundIntakeMigration, /unknown_custody/);
  assert.match(foundIntakeMigration, /'unknown_custody', 'open', true/);
  assert.match(foundIntakeMigration, /found_in_warehouse/);
  assert.match(actions, /openFoundWarehouseIntakeAction/);
  assert.match(actions, /scanFoundWarehouseIntakePackageAction/);
  assert.match(component, /const \[foundOpen, setFoundOpen\] = useState\(false\)/);
  assert.match(component, /aria-labelledby="warehouse-found-title"/);
  assert.match(component, />Caja encontrada<\/button>/);
  assert.match(component, /Sin camión/);
});
