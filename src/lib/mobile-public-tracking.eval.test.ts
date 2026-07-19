import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = join(process.cwd(), "src");
const read = (...parts: string[]) => readFileSync(join(root, ...parts), "utf8");

describe("mobile navigation and public tracking eval", () => {
  it("keeps mobile navigation thumb-reachable with a role-aware bottom bar", () => {
    const shell = read("components", "app-shell.tsx");
    assert.match(shell, /function MobileBottomNav/);
    assert.match(shell, /session\?\.roleSlug === "conductor"/);
    assert.match(shell, /pb-\[max\(0\.5rem,env\(safe-area-inset-bottom\)\)\]/);
    assert.doesNotMatch(shell, /fixed bottom-5 right-5/);
  });

  it("makes the customer portal public but preserves server-only verification", () => {
    const proxy = read("proxy.ts");
    const proxyPaths = read("lib", "auth", "proxy-paths.ts");
    const route = read("app", "api", "public", "tracking", "route.ts");
    const dto = read("lib", "public-tracking.ts");
    assert.match(proxy, /isPublicProxyPath\(pathname\)/);
    assert.match(proxyPaths, /"\/rastrear"/);
    assert.match(route, /enforcePublicTrackingRateLimit/);
    assert.match(route, /senderPhoneMatches/);
    assert.match(dto, /export type PublicTrackingShipment/);
    assert.doesNotMatch(dto, /profit:/);
    assert.doesNotMatch(dto, /assigned_to:/);
  });
});
