import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const permissionsSource = readFileSync(
  join(process.cwd(), "src", "lib", "auth", "permissions.ts"),
  "utf8",
);
const platformActionsSource = readFileSync(
  join(process.cwd(), "src", "app", "actions", "platform.ts"),
  "utf8",
);
const appShellSource = readFileSync(
  join(process.cwd(), "src", "components", "app-shell.tsx"),
  "utf8",
);

describe("agency module entitlement eval", () => {
  it("uses one server-side entitlement for direct routes and agency permissions", () => {
    assert.match(permissionsSource, /permission\.startsWith\("agency\."\)/);
    for (const route of ["/agencia", "/agencias", "/captacion", "/solicitudes"]) {
      assert.match(permissionsSource, new RegExp(route));
    }
  });

  it("keeps the entitlement under platform control and lets the shell inherit route filtering", () => {
    assert.match(platformActionsSource, /agenciesEnabled/);
    assert.match(platformActionsSource, /agencies_enabled/);
    assert.match(appShellSource, /canAccessPath\(session, item\.href\)/);
  });
});
