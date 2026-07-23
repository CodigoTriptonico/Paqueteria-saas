import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const guardedScripts = [
  "scripts/restore-platform-owner.mjs",
  "scripts/db-reset-passwords.mjs",
  "scripts/db-rename-user-email.mjs",
  "scripts/seed-conductors.mjs",
  "scripts/test-platform-auth-flow.mjs",
  "scripts/test-sms-flow.mjs",
];

test("credential-changing scripts share the local-only guard", () => {
  for (const relativePath of guardedScripts) {
    const source = readFileSync(join(root, relativePath), "utf8");
    assert.match(source, /assertLocalCredentialScript\(\)/, relativePath);
  }
});

test("versioned executable scripts do not contain a canonical password fallback", () => {
  for (const relativePath of guardedScripts) {
    const source = readFileSync(join(root, relativePath), "utf8");
    assert.doesNotMatch(source, /LOCAL_CANONICAL_PASSWORD/, relativePath);
  }
});
