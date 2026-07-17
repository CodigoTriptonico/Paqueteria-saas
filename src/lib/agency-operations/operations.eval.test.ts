import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/072_agency_operations.sql"),
  "utf8",
);
const documentation = readFileSync(
  join(process.cwd(), "docs/agency-operations.md"),
  "utf8",
);

test("agency requests and combined visits retain requested and confirmed quantities", () => {
  assert.match(migration, /create table public\.agency_service_requests/);
  assert.match(migration, /create table public\.agency_service_request_lines/);
  assert.match(migration, /create table public\.agency_visits/);
  assert.match(migration, /create table public\.agency_visit_lines/);
  assert.match(migration, /requested_quantity integer not null/);
  assert.match(migration, /confirmed_quantity integer/);
  assert.match(migration, /difference_reason text not null/);
  assert.match(migration, /evidence jsonb not null/);
  assert.match(migration, /responsible_membership_id uuid/);
});

test("visit confirmation is one tenant-derived idempotent database transaction", () => {
  const signature = migration.match(/create function public\.confirm_agency_visit\(([\s\S]*?)\)\nreturns jsonb/);
  assert.ok(signature);
  assert.doesNotMatch(signature[1], /tenant_id/);
  assert.match(migration, /tenant uuid := public\.current_tenant_id\(\)/);
  assert.match(migration, /operation_type = 'confirm_agency_visit'/);
  assert.match(migration, /return operation_row\.result \|\| jsonb_build_object\('replayed', true\)/);
  assert.match(migration, /from public\.agency_visits[\s\S]*for update/);
  assert.match(migration, /update public\.inventory_stock set stock = stock - confirmed_value/);
  assert.match(migration, /insert into public\.agency_charges/);
  assert.match(migration, /when 'empty_box_delivery' then 'empty_box'/);
  assert.match(migration, /on conflict \(tenant_id, source_operation_type, source_operation_id, concept\) do nothing/);
  assert.match(migration, /insert into public\.immutable_audit_events/);
});

test("box custody is quantity based and FIFO without automatic penalties", () => {
  assert.match(migration, /create table public\.agency_box_batches/);
  assert.match(migration, /create table public\.agency_box_lots/);
  assert.match(migration, /create table public\.agency_box_movements/);
  assert.match(migration, /source in \('matrix_purchased', 'own_box'\)/);
  assert.match(migration, /order by lot\.delivered_at, lot\.id/);
  assert.match(migration, /allocation_status = case when remaining = 0 then 'allocated' else 'insufficient' end/);
  assert.match(migration, /lot_row\.id, 'used', -allocate_now, 'agency_shipment_box_source'/);
  assert.match(migration, /create view public\.agency_box_lot_balances/);
  assert.match(migration, /now\(\) - lot\.delivered_at as age/);
  assert.doesNotMatch(migration, /penalty|late_fee|multa/i);
  assert.match(documentation, /No tienen QR ni identidad individual/);
  assert.match(documentation, /No crean cargos, multas ni ajustes automáticos/);
});

test("default agency route is historical and operational route remains visit-specific", () => {
  assert.match(migration, /create table public\.agency_default_route_assignments/);
  assert.match(migration, /route_template_id uuid not null references public\.logistics_route_templates/);
  assert.match(migration, /where ended_at is null/);
  assert.match(migration, /route_id uuid references public\.logistics_routes/);
  assert.match(documentation, /Cambiarla no cambia la asignación predeterminada/);
});

test("agency, captor and supervisor commands preserve optimistic history", () => {
  assert.match(migration, /create function public\.transition_agency_status/);
  assert.match(migration, /agency_row\.status_version <> expected_version/);
  assert.match(migration, /insert into public\.agency_status_history/);
  assert.match(migration, /create function public\.assign_agency_captor/);
  assert.match(migration, /create function public\.assign_captor_supervisor/);
  assert.match(migration, /set ended_at = now\(\)/);
  assert.match(migration, /previous_captor_membership_id is not distinct from captor_row\.id/);
  assert.match(migration, /previous_supervisor_membership_id is not distinct from supervisor_row\.id/);
  assert.match(migration, /insert into public\.agency_captor_assignments/);
  assert.match(migration, /insert into public\.captor_supervisor_assignments/);
});

test("operational reads require tenant and organization authorization", () => {
  assert.match(migration, /public\.tenant_organization_access\(target_tenant_id, target_organization_id\)/);
  assert.match(migration, /public\.current_membership_has_permission\([\s\S]*target_tenant_id, target_organization_id/);
  assert.match(migration, /tenant_id = public\.current_tenant_id\(\)/);
  assert.match(migration, /create function public\.agency_operations_validate_scope/);
  assert.match(migration, /raise exception 'AGENCY_SCOPE_MISMATCH'/);
  assert.match(migration, /raise exception 'VISIT_LINE_SCOPE_MISMATCH'/);
});
