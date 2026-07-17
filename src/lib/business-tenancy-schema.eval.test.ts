import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const migration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "070_business_tenants_agencies.sql"),
  "utf8",
);

describe("business tenancy quality eval", () => {
  it("models the complete agency lifecycle with optimistic history", () => {
    for (const status of [
      "prospect",
      "registration_started",
      "documents_pending",
      "approval_pending",
      "activation_pending",
      "active",
      "temporarily_suspended",
      "debt_blocked",
      "inactive",
      "closed",
      "rejected",
    ]) {
      assert.match(migration, new RegExp(`'${status}'`), `Falta estado ${status}`);
    }
    assert.match(migration, /status_version integer not null default 1/i);
    assert.match(migration, /unique \(agency_id, version\)/i);
    assert.match(migration, /actor_membership_id uuid/i);
  });

  it("makes cross-tenant agency access structurally unreachable", () => {
    assert.match(
      migration,
      /foreign key \(tenant_id, matrix_organization_id\)[\s\S]*business_tenants\(id, matrix_organization_id\)/i,
    );
    assert.match(
      migration,
      /current_membership_has_permission\([\s\S]*tenant_organization_access\(target_tenant_id, target_organization_id\)/i,
    );
    assert.match(
      migration,
      /membership\.tenant_id is distinct from target_tenant_id[\s\S]*return false/i,
    );
  });

  it("supports tenant, organization, portfolio, team and delegated support without switching membership", () => {
    for (const scope of ["tenant", "organization", "team", "portfolio", "assigned_resource"]) {
      assert.match(migration, new RegExp(`'${scope}'`), `Falta alcance ${scope}`);
    }
    assert.match(migration, /agency_captor_assignments assignment/i);
    assert.match(migration, /captor_supervisor_assignments supervision/i);
    assert.match(migration, /agency_support_delegations delegation/i);
    assert.match(migration, /permission_key = any\(delegation\.permissions\)/i);
  });

  it("denies direct writes while allowing audited RPCs to own mutations", () => {
    for (const table of [
      "organization_memberships",
      "agencies",
      "agency_status_history",
      "agency_captor_assignments",
      "captor_supervisor_assignments",
      "agency_support_delegations",
      "immutable_audit_events",
      "idempotency_operations",
    ]) {
      assert.match(
        migration,
        new RegExp(`${table}_deny_direct(?:_write)?[\\s\\S]*using \\(false\\)`, "i"),
        `${table} permite escritura directa`,
      );
    }
  });

  it("uses Agencia as the target vocabulary and marks distribution as compatibility only", () => {
    assert.match(migration, /distribution_\* es compatibilidad temporal/i);
    assert.match(migration, /'agency\.view', 'Ver agencias'/i);
    assert.doesNotMatch(migration, /'distribution\.manage', 'Distribuidores'/i);
  });

  it("forbids hard deletion of scoped identities and hierarchy", () => {
    assert.match(migration, /prevent_scoped_organization_delete/i);
    assert.match(migration, /prevent_profile_membership_delete/i);
    assert.match(migration, /prevent_organization_membership_delete/i);
    assert.match(migration, /prevent_agency_delete/i);
    assert.match(migration, /HARD_DELETE_FORBIDDEN/i);
  });
});
