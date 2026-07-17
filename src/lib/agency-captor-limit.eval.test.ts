import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/075_captor_agency_demo_limit.sql"),
  "utf8",
);
const commands = readFileSync(join(process.cwd(), "src/app/actions/business-commands.ts"), "utf8");
const platform = readFileSync(join(process.cwd(), "src/app/actions/platform.ts"), "utf8");
const matrixInitialization = readFileSync(
  join(process.cwd(), "supabase/migrations/076_initialize_new_business_matrix.sql"),
  "utf8",
);

describe("captor agency demo limit eval", () => {
  it("stores the per-captor allowance on the tenant and defaults it to three", () => {
    assert.match(migration, /max_agencies_per_captor integer not null default 3/);
    assert.match(migration, /check \(max_agencies_per_captor between 0 and 1000\)/);
  });

  it("enforces active portfolios transactionally at the assignment boundary", () => {
    assert.match(migration, /create or replace function public\.enforce_captor_agency_portfolio_limit/);
    assert.match(migration, /pg_advisory_xact_lock/);
    assert.match(migration, /agency\.archived_at is null/);
    assert.match(migration, /CAPTOR_AGENCY_LIMIT_REACHED/);
    assert.match(migration, /before insert or update of tenant_id, captor_membership_id, ended_at/);
  });

  it("gives captors the agency creation permission and translates the limit error", () => {
    assert.match(migration, /role\.slug = 'captador_agencias'/);
    assert.match(migration, /permission\.key = 'agency\.create'/);
    assert.match(commands, /isCaptorAgencyLimitError/);
    assert.match(commands, /captorAgencyLimitMessage/);
  });

  it("prepares every newly created client as a matrix with captor roles", () => {
    assert.match(platform, /initialize_business_matrix_organization/);
    assert.match(matrixInitialization, /insert into public\.business_tenants/);
    assert.match(matrixInitialization, /organization_type = 'matrix'/);
    assert.match(matrixInitialization, /'captador_agencias'/);
    assert.match(matrixInitialization, /'agency\.create'/);
    assert.match(matrixInitialization, /insert into public\.organization_memberships/);
  });
});
