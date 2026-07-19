import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const authActionsSource = readFileSync(join(root, "src", "app", "actions", "auth.ts"), "utf8");
const accountMenuSource = readFileSync(
  join(root, "src", "components", "user-account-menu.tsx"),
  "utf8",
);
const loginPageSource = readFileSync(join(root, "src", "app", "login", "page.tsx"), "utf8");
const proxySource = readFileSync(join(root, "src", "proxy.ts"), "utf8");

describe("auth session flow eval", () => {
  it("keeps logout behind the conductor offline-operation guard", () => {
    const pendingCheck = accountMenuSource.indexOf("countUnconfirmedConductorOperations");
    const signOut = accountMenuSource.indexOf("await signOutAction()");

    assert.ok(pendingCheck >= 0);
    assert.ok(signOut > pendingCheck);
    assert.match(accountMenuSource, /if \(pendingCount > 0\)[\s\S]*return;/);
  });

  it("clears Supabase cookies in the existing server action before redirecting", () => {
    assert.match(authActionsSource, /isSupabaseAuthCookie/);
    assert.match(authActionsSource, /cookieStore\.delete\(cookie\.name\)/);
    assert.ok(authActionsSource.indexOf("cookieStore.delete") < authActionsSource.indexOf('redirect("/login")'));
  });

  it("uses proxy refresh for login instead of duplicating session resolution in the page", () => {
    assert.match(proxySource, /resolveAuthenticatedLoginPath/);
    assert.match(proxySource, /await resolveAuthUser/);
    assert.doesNotMatch(loginPageSource, /getAppSession|redirect\(/);
  });
});
