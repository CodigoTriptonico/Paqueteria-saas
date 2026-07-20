import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const configSource = readFileSync(
  join(process.cwd(), "src", "components", "configuracion-client.tsx"),
  "utf8",
);
const managementSource = readFileSync(
  join(process.cwd(), "src", "components", "config", "organization-management-panel.tsx"),
  "utf8",
);

describe("organization management information architecture", () => {
  it("replaces three landing cards with one company and access entry", () => {
    assert.match(configSource, /id: "organization" as Section/);
    assert.match(configSource, /title: "Empresa y acceso"/);
    assert.doesNotMatch(configSource, /id: "plan" as Section/);
    assert.doesNotMatch(configSource, /id: "company" as Section/);
    assert.doesNotMatch(configSource, /id: "users" as Section/);
  });

  it("keeps Empresa, Plan and Usuarios available as clear internal tabs", () => {
    assert.match(managementSource, /label: "Empresa"/);
    assert.match(managementSource, /label: "Plan"/);
    assert.match(managementSource, /label: "Usuarios"/);
    assert.match(managementSource, /ariaLabel="Empresa, plan y usuarios"/);
  });
});
