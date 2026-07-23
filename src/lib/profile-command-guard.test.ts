import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/134_allow_authorized_profile_commands.sql",
  ),
  "utf8",
);

describe("profile authorization command guard", () => {
  it("recognizes the effective database owner before the caller JWT", () => {
    assert.match(
      migration,
      /if current_user in \('postgres', 'supabase_admin'\)\s+or caller_role = 'service_role'/,
    );
    assert.doesNotMatch(
      migration,
      /caller_role text := coalesce\(auth\.role\(\), current_user\)/,
    );
  });

  it("retains self-escalation, organization and role-scope blocks", () => {
    assert.match(migration, /PROFILE_SELF_AUTHORIZATION_FIELDS_FORBIDDEN/);
    assert.match(migration, /PROFILE_ORGANIZATION_IMMUTABLE/);
    assert.match(migration, /PROFILE_ADMIN_UPDATE_FORBIDDEN/);
    assert.match(migration, /PROFILE_ROLE_SCOPE_MISMATCH/);
  });
});
