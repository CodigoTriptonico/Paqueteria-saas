import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const source = readFileSync(
  join(process.cwd(), "src/components/pwa/service-worker-register.tsx"),
  "utf8",
);

describe("service worker registration eval", () => {
  it("does not register the worker in development and removes stale app caches", () => {
    assert.match(source, /nodeEnv: process\.env\.NODE_ENV/);
    assert.match(source, /process\.env\.NODE_ENV !== "production"/);
    assert.match(source, /registration\.unregister\(\)/);
    assert.match(source, /new URL\(controllerUrl\)\.pathname === "\/sw\.js"/);
    assert.match(source, /name\.startsWith\("boxario-static-"\)/);
    assert.match(source, /window\.location\.reload\(\)/);
  });
});
