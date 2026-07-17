import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const migration = readFileSync(join(root, "supabase/migrations/077_agency_demo_team_limits.sql"), "utf8");
const agencyAction = readFileSync(join(root, "src/app/actions/agencies.ts"), "utf8");
const captorPanel = readFileSync(join(root, "src/components/business/agency-captor-create-panel.tsx"), "utf8");
const teamPanel = readFileSync(join(root, "src/components/business/agency-team-panel.tsx"), "utf8");
const userActions = readFileSync(join(root, "src/app/actions/users.ts"), "utf8");
const permissions = readFileSync(join(root, "src/lib/auth/permissions.ts"), "utf8");

describe("agency demo team eval", () => {
  it("gives each agency one administrator and two seller seats at the database boundary", () => {
    assert.match(migration, /max_administrators integer not null default 1/);
    assert.match(migration, /max_sellers integer not null default 2/);
    assert.match(migration, /before insert or update of organization_id, role_id, is_active, archived_at/);
    assert.match(migration, /AGENCY_SELLER_LIMIT_REACHED/);
    assert.match(migration, /AGENCY_ADMIN_LIMIT_REACHED/);
    assert.match(migration, /AGENCY_ADMIN_REQUIRED/);
    assert.match(migration, /AGENCY_ROLE_NOT_ALLOWED/);
    assert.match(migration, /pg_advisory_xact_lock/);
  });

  it("makes captors create an agency with its responsible administrator and restricted roles", () => {
    assert.match(agencyAction, /createCaptorAgencyAction/);
    assert.match(agencyAction, /initialize_captor_agency_organization/);
    assert.match(migration, /'administrador_agencia'/);
    assert.match(migration, /'vendedor_agencia'/);
    assert.match(migration, /delete from public\.roles/);
    assert.match(migration, /insert into public\.agency_captor_assignments/);
    assert.match(captorPanel, /Incluye 1 administrador y hasta 2 vendedores/);
  });

  it("exposes a compact administrator-only seller roster and maps database errors", () => {
    assert.match(teamPanel, /vendedor_agencia/);
    assert.match(teamPanel, /agencyDemoSellerLimit/);
    assert.match(userActions, /canManageOrganizationUsers/);
    assert.match(userActions, /agencyDemoTeamErrorMessage/);
    assert.match(permissions, /pathname === "\/agencia\/equipo"/);
  });
});
