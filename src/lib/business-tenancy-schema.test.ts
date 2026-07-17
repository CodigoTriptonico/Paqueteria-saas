import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const migration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "070_business_tenants_agencies.sql"),
  "utf8",
);

function tableDefinition(table: string) {
  const match = migration.match(
    new RegExp(`create table if not exists public\\.${table} \\(([\\s\\S]*?)\\n\\);`, "i"),
  );
  assert.ok(match, `Falta la tabla ${table}`);
  return match[1];
}

describe("business tenant schema gate", () => {
  it("keeps Boxario outside business tenants and backfills each matrix deterministically", () => {
    assert.match(migration, /where organization\.kind = 'client'/i);
    assert.match(migration, /not exists \([\s\S]*distribution_partners[\s\S]*distributor_organization_id/i);
    assert.match(migration, /select[\s\S]*organization\.id,[\s\S]*organization\.id,[\s\S]*organization\.created_at/i);
    assert.match(
      migration,
      /update public\.organizations[\s\S]*set[\s\S]*tenant_id = null[\s\S]*where kind = 'platform'/i,
    );
  });

  it("requires tenant and organization together on every new scoped record", () => {
    for (const table of [
      "organization_memberships",
      "agencies",
      "agency_status_history",
      "agency_captor_assignments",
      "captor_supervisor_assignments",
      "agency_support_delegations",
    ]) {
      const definition = tableDefinition(table);
      assert.match(definition, /tenant_id uuid not null/i, `${table} no exige tenant_id`);
    }

    assert.match(
      tableDefinition("organization_memberships"),
      /foreign key \(tenant_id, organization_id\)[\s\S]*organizations\(tenant_id, id\)/i,
    );
    assert.match(
      tableDefinition("agencies"),
      /foreign key \(tenant_id, organization_id\)[\s\S]*organizations\(tenant_id, id\)/i,
    );
  });

  it("enforces one active business membership and historical assignments", () => {
    assert.match(
      migration,
      /organization_memberships_one_active_per_user[\s\S]*on public\.organization_memberships\(user_id\)[\s\S]*where status = 'active' and ended_at is null/i,
    );
    assert.match(
      migration,
      /agency_captor_assignments_one_active[\s\S]*on public\.agency_captor_assignments\(agency_id\)[\s\S]*where ended_at is null/i,
    );
    assert.match(
      migration,
      /captor_supervisor_assignments_one_active[\s\S]*on public\.captor_supervisor_assignments\(captor_membership_id\)[\s\S]*where ended_at is null/i,
    );
    assert.doesNotMatch(tableDefinition("organization_memberships"), /on delete cascade/i);
  });

  it("derives tenant and organization from the authenticated membership", () => {
    for (const helper of [
      "current_membership_id",
      "current_tenant_id",
      "current_business_organization_id",
      "tenant_organization_access",
      "current_membership_has_permission",
    ]) {
      assert.match(
        migration,
        new RegExp(`function public\\.${helper}\\(`, "i"),
        `Falta ${helper}`,
      );
    }
    assert.match(migration, /membership\.user_id = auth\.uid\(\)/i);
    assert.match(migration, /membership\.tenant_id is distinct from target_tenant_id/i);
    assert.doesNotMatch(migration, /current_setting\s*\(\s*'[^']*tenant/i);
  });

  it("stores immutable audit context and a tenant-scoped idempotency result", () => {
    const audit = tableDefinition("immutable_audit_events");
    for (const field of [
      "tenant_id",
      "organization_id",
      "actor_membership_id",
      "before_state",
      "after_state",
      "reason",
      "request_id",
      "idempotency_key",
    ]) {
      assert.match(audit, new RegExp(`\\b${field}\\b`, "i"), `Falta audit.${field}`);
    }
    assert.match(
      tableDefinition("idempotency_operations"),
      /unique \(tenant_id, operation_type, idempotency_key\)/i,
    );
    assert.match(
      migration,
      /before update or delete on public\.immutable_audit_events/i,
    );
  });
});
