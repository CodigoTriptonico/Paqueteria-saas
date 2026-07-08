import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const scriptsDir = join(root, "scripts");

const criticalScripts = [
  "wipe-database.mjs",
  "seed-scgs-demo-catalog.mjs",
  "clear-sales-history.mjs",
];

for (const scriptName of criticalScripts) {
  test(`${scriptName} passes node --check`, () => {
    const scriptPath = join(scriptsDir, scriptName);
    assert.doesNotThrow(() => {
      execFileSync(process.execPath, ["--check", scriptPath], { stdio: "pipe" });
    });
  });
}

test("scripts/lib has at least one test file", () => {
  const libTests = readdirSync(join(scriptsDir, "lib")).filter((name) => name.endsWith(".test.mjs"));
  assert.ok(libTests.length > 0);
});
