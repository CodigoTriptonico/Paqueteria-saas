import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const scriptsDir = join(root, "scripts");

const criticalScripts = [
  "wipe-database.mjs",
  "seed-scgs-demo-catalog.mjs",
  "clear-sales-history.mjs",
  "reset-operational-data-keep-catalog.mjs",
  "reset-app-to-baseline.mjs",
];

for (const scriptName of criticalScripts) {
  test(`${scriptName} passes node --check`, () => {
    const scriptPath = join(scriptsDir, scriptName);
    assert.doesNotThrow(() => {
      execFileSync(process.execPath, ["--check", scriptPath], { stdio: "pipe" });
    });
  });
}

test("clear-sales-history deletes custody facts before shipments", () => {
  const source = readFileSync(join(scriptsDir, "clear-sales-history.mjs"), "utf8");
  assert.match(source, /package_custody_events_immutable/);
  assert.match(source, /disable trigger package_custody_events_immutable/);
  const custodyIdx = source.indexOf('deleteByOrg(client, "package_custody_events"');
  const shipmentsIdx = source.indexOf('deleteByOrg(client, "shipments"');
  assert.ok(custodyIdx >= 0 && shipmentsIdx > custodyIdx);
});

test("scripts/lib has at least one test file", () => {
  const libTests = readdirSync(join(scriptsDir, "lib")).filter((name) => name.endsWith(".test.mjs"));
  assert.ok(libTests.length > 0);
});
