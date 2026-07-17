import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/078_fix_matrix_initialization_role_alias.sql"),
  "utf8",
);
const platformAction = readFileSync(
  join(process.cwd(), "src/app/actions/platform.ts"),
  "utf8",
);

describe("new company matrix initialization eval", () => {
  it("initializes memberships from the assigned role after bootstrapping the owner", () => {
    assert.match(platformAction, /bootstrap_organization[\s\S]*initialize_business_matrix_organization/);
    assert.match(migration, /member_role\.user_id/);
    assert.match(migration, /member_role\.role_id/);
    assert.match(migration, /member_role\.slug/);
    assert.match(migration, /insert into public\.organization_memberships/);
  });
});
