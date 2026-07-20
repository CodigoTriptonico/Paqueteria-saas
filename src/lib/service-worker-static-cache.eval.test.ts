import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const swSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "..", "public", "sw.js"),
  "utf8",
);

describe("service worker static cache eval", () => {
  it("clones static responses before async cache writes", () => {
    assert.match(swSource, /const copy = response\.clone\(\)/);
    assert.doesNotMatch(swSource, /cache\.put\(request, response\.clone\(\)\)/);
  });

  it("serves cached static assets without a background refetch", () => {
    assert.match(swSource, /if \(cached\) \{\s*return cached;\s*\}/);
    assert.doesNotMatch(swSource, /return cached \|\| network/);
  });

  it("invalidates the previous static cache namespace on worker updates", () => {
    assert.match(swSource, /const STATIC_CACHE = "boxario-static-v2"/);
    assert.match(swSource, /key\.startsWith\("boxario-static-"\)/);
  });
});
