import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const migration126 = readFileSync(
  join(root, "supabase", "migrations", "126_protect_organization_plan_settings.sql"),
  "utf8",
);
const migration127 = readFileSync(
  join(root, "supabase", "migrations", "127_protect_organization_logo_path.sql"),
  "utf8",
);
const platformAction = readFileSync(
  join(root, "src", "app", "actions", "platform.ts"),
  "utf8",
);
const storageUrl = readFileSync(
  join(root, "src", "lib", "supabase", "storage-url.ts"),
  "utf8",
);

describe("organization plan settings protection", () => {
  it("locks max_users, max_warehouses, and agencies_enabled for non-platform actors", () => {
    assert.match(migration126, /protect_organization_plan_settings/);
    assert.match(migration126, /auth\.role\(\) = 'service_role'/);
    assert.match(migration126, /auth\.uid\(\) is null/);
    assert.match(migration126, /public\.is_platform_admin\(\)/);
    assert.match(migration126, /max_users/);
    assert.match(migration126, /max_warehouses/);
    assert.match(migration126, /agencies_enabled/);
    assert.match(migration126, /before update of settings on public\.organizations/);
    assert.match(migration126, /organizations_protect_plan_settings/);
  });

  it("only allows company_logo_path under the organization id folder", () => {
    assert.match(migration127, /company_logo_path/);
    assert.match(migration127, /logo_path like \(org_prefix \|\| '\/%'\)/);
    assert.match(migration127, /position\('\.\.' in logo_path\)/);
  });

  it("rejects non-finite plan limits in the platform update action", () => {
    assert.match(platformAction, /Number\.isFinite\(input\.maxWarehouses\)/);
    assert.match(platformAction, /Number\.isFinite\(input\.maxUsers\)/);
    assert.match(platformAction, /Límite de bodegas inválido/);
    assert.match(platformAction, /Límite de usuarios inválido/);
  });

  it("requires ownerId checks before minting signed storage URLs", () => {
    assert.match(storageUrl, /storagePathOwnedBy/);
    assert.match(storageUrl, /options\.ownerId/);
    assert.match(storageUrl, /isSafeStorageObjectPath/);
  });
});
