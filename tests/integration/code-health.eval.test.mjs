import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { sourceTextIssues } from "../../scripts/lib/code-health.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("runtime source stays free of debug calls and corrupted UTF-8 text", () => {
  assert.deepEqual(sourceTextIssues(root), []);
});

test("code-health commands gate warnings, dead code, and duplicate growth", () => {
  const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.equal(
    packageJson.scripts["check:code"],
    "eslint --max-warnings=0 && knip && npm run check:duplicates",
  );
  assert.match(packageJson.scripts["check:duplicates"], /--threshold 3/);
  assert.equal(packageJson.scripts.test, "npm run test:gate && npm run test:eval");
});
