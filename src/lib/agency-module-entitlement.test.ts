import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { isAgencyModuleEnabled } from "@/lib/organizations/settings";

const migration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "113_agency_module_entitlement.sql"),
  "utf8",
);

describe("agency module entitlement", () => {
  it("is disabled unless Boxario explicitly enables it", () => {
    assert.equal(isAgencyModuleEnabled(undefined), false);
    assert.equal(isAgencyModuleEnabled({}), false);
    assert.equal(isAgencyModuleEnabled({ agencies_enabled: false }), false);
    assert.equal(isAgencyModuleEnabled({ agencies_enabled: true }), true);
  });

  it("blocks agency permissions in the database when the tenant module is off", () => {
    assert.match(migration, /tenant_has_agency_module/);
    assert.match(migration, /permission_key like 'agency\.\%'/);
    assert.match(migration, /not coalesce\(public\.tenant_has_agency_module/);
    assert.match(migration, /'\{agencies_enabled\}'[\s\S]*'false'::jsonb/);
  });
});
