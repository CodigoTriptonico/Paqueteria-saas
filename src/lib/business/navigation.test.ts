import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const shell = readFileSync(join(process.cwd(), "src/components/app-shell.tsx"), "utf8");
const frame = readFileSync(join(process.cwd(), "src/components/app-frame.tsx"), "utf8");

describe("business navigation", () => {
  it("does not split the current agency into Trabajo and Agencias", () => {
    const agencySection = shell.indexOf('{ id: "agencies", label: "Agencias" }');
    const ownAgencyItem = shell.indexOf('{ label: "Mi agencia", href: "/agencia", icon: Building2, section: "agencies" }');
    const managedAgenciesItem = shell.indexOf('{ label: "Agencias a mi cargo", href: "/captacion", icon: Users, section: "agencies" }');

    assert.ok(agencySection >= 0);
    assert.ok(ownAgencyItem > agencySection);
    assert.ok(managedAgenciesItem > ownAgencyItem);
    assert.equal(shell.includes('label: "Mis agencias"'), false);
    assert.match(frame, /pathname\.startsWith\("\/captacion"\)[\s\S]*return "Agencias a mi cargo"/);
  });
});
