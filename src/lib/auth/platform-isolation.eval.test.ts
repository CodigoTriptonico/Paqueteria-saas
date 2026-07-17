import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const source = (relativePath: string) =>
  readFileSync(join(root, relativePath), "utf8");

describe("platform isolation eval", () => {
  it("removes organization switching endpoints and cookie contract", () => {
    assert.equal(
      existsSync(join(root, "src", "app", "actions", "act-as.ts")),
      false,
    );
    assert.equal(
      existsSync(join(root, "src", "lib", "auth", "act-as.ts")),
      false,
    );
    assert.doesNotMatch(
      source("src/lib/auth/session.ts"),
      /act-as|ACT_AS|actingOrganization/i,
    );
    assert.doesNotMatch(source("src/proxy.ts"), /ACT_AS|act-as/i);
  });

  it("does not escalate client reads through a privileged server client", () => {
    const scoped = source("src/lib/supabase/scoped.ts");
    assert.doesNotMatch(scoped, /createSupabaseAdminClient|isActingAsClient/);
    assert.match(scoped, /createSupabaseServerClient/);
  });

  it("keeps the platform console focused on company administration", () => {
    const consoleSource = source(
      "src/components/platform/platform-console.tsx",
    );
    const actionsSource = source("src/app/actions/platform.ts");
    assert.match(
      consoleSource,
      /Cada empresa controla por su cuenta sus\s+usuarios, permisos y datos operativos/,
    );
    assert.doesNotMatch(
      consoleSource,
      /Operar|Nuevo usuario|Archivar empleado/,
    );
    assert.doesNotMatch(
      actionsSource,
      /OrgUserAsPlatformAdmin|listOrganizationUsersAction/,
    );
  });
});
