import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const page = readFileSync(join(root, "src/app/perfil/page.tsx"), "utf8");
const client = readFileSync(join(root, "src/components/profile/profile-account-client.tsx"), "utf8");
const actions = readFileSync(join(root, "src/app/actions/profile.ts"), "utf8");
const migration = readFileSync(join(root, "supabase/migrations/080_profile_account.sql"), "utf8");

describe("profile account eval", () => {
  it("keeps profile access independent from operational settings", () => {
    assert.match(page, /requirePathAccess\("\/perfil"\)/);
    assert.match(client, /Tu acceso/);
    assert.match(client, /Permisos activos/);
    assert.match(client, /Cambiar contraseña/);
  });

  it("requires the current password and uploads only to the signed private avatar bucket", () => {
    assert.match(actions, /signInWithPassword/);
    assert.match(actions, /verified\.user\?\.id !== session\.userId/);
    assert.match(actions, /validateAvatarUpload/);
    assert.match(migration, /'profile-avatars'/);
    assert.match(migration, /false,\s*\n\s*4194304/);
    assert.match(migration, /profile_avatars_select_own/);
    assert.match(migration, /auth\.uid\(\)::text/);
  });
});
