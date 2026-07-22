import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const demoResetSource = readFileSync(
  join(root, "scripts/reset-scgs-demo-data.mjs"),
  "utf8",
);
const packageSource = readFileSync(join(root, "package.json"), "utf8");

describe("reset scgs demo data eval", () => {
  it("does not ship the old org reset that deleted users", () => {
    assert.equal(existsSync(join(root, "scripts/reset-scgs-org.mjs")), false);
  });

  it("wires db:reset:scgs to the safe demo reset script", () => {
    assert.match(packageSource, /"db:reset:scgs": "node scripts\/reset-scgs-demo-data\.mjs"/);
    assert.doesNotMatch(packageSource, /reset-scgs-org\.mjs/);
  });

  it("never deletes auth users or profiles in the demo reset script", () => {
    assert.doesNotMatch(demoResetSource, /delete from auth\.users/i);
    assert.doesNotMatch(demoResetSource, /delete from public\.profiles/i);
    assert.doesNotMatch(demoResetSource, /delete from public\.profile_warehouses/i);
    assert.doesNotMatch(demoResetSource, /delete from public\.warehouses/i);
  });

  it("documents that team users are preserved", () => {
    assert.match(demoResetSource, /Usuarios auth y perfiles/i);
    assert.match(demoResetSource, /Usuarios: NO se tocan/);
    assert.match(demoResetSource, /after\.profiles !== before\.profiles/);
  });

  it("clears shipment child tables before deleting shipments", () => {
    assert.match(demoResetSource, /package_custody_events/);
    assert.match(demoResetSource, /package_custody_events_immutable/);
    assert.match(demoResetSource, /shipment_payments/);
    assert.match(demoResetSource, /shipment_logistics_tasks/);
    const custodyAt = demoResetSource.indexOf('"package_custody_events"');
    const shipmentsAt = demoResetSource.indexOf('"shipments"');
    assert.ok(custodyAt > -1 && shipmentsAt > custodyAt);
  });
});
