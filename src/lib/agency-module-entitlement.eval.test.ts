import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const permissionsSource = readFileSync(
  join(process.cwd(), "src", "lib", "auth", "permissions.ts"),
  "utf8",
);
const platformActionsSource = readFileSync(
  join(process.cwd(), "src", "app", "actions", "platform.ts"),
  "utf8",
);
const appShellSource = readFileSync(
  join(process.cwd(), "src", "components", "app-shell.tsx"),
  "utf8",
);
const planSource = readFileSync(
  join(process.cwd(), "src", "components", "config", "plan-settings-panel.tsx"),
  "utf8",
);
const commercialSource = readFileSync(
  join(process.cwd(), "src", "components", "commercial", "commercial-admin-client.tsx"),
  "utf8",
);
const commercialActionsSource = readFileSync(
  join(process.cwd(), "src", "app", "actions", "commercial-config.ts"),
  "utf8",
);
const financeSource = readFileSync(
  join(process.cwd(), "src", "components", "business", "business-command-center.tsx"),
  "utf8",
);
const countryServiceSource = readFileSync(
  join(process.cwd(), "src", "components", "config", "country-commercial-service-costs.tsx"),
  "utf8",
);
const businessWorkspaceActionSource = readFileSync(
  join(process.cwd(), "src", "app", "actions", "business-workspace.ts"),
  "utf8",
);
const inventoryActionsSource = [
  readFileSync(join(process.cwd(), "src", "app", "actions", "inventory.ts"), "utf8"),
  readFileSync(join(process.cwd(), "src", "app", "actions", "inventory-assignments.ts"), "utf8"),
].join("\n");

describe("agency module entitlement eval", () => {
  it("uses one server-side entitlement for direct routes and agency permissions", () => {
    assert.match(permissionsSource, /permission\.startsWith\("agency\."\)/);
    for (const route of ["/agencia", "/agencias", "/captacion", "/solicitudes"]) {
      assert.match(permissionsSource, new RegExp(route));
    }
  });

  it("keeps the entitlement under platform control and lets the shell inherit route filtering", () => {
    assert.match(platformActionsSource, /agenciesEnabled/);
    assert.match(platformActionsSource, /agencies_enabled/);
    assert.match(appShellSource, /canAccessPath\(session, item\.href\)/);
  });

  it("removes agency references from every shared client surface while disabled", () => {
    assert.match(planSource, /usage\.agenciesEnabled \? <section/);
    assert.match(commercialSource, /initialData\.agencyModuleEnabled \? "Vendedores y Agencias" : "Vendedores"/);
    assert.match(commercialSource, /initialData\.agencyModuleEnabled \? <AppTabs/);
    assert.match(financeSource, /if \(!agencyModuleEnabled\)/);
    assert.match(countryServiceSource, /agencyModuleEnabled \? "Las agencias y vendedores los heredan" : "Los vendedores los heredan"/);
  });

  it("does not send hidden agency records through shared server payloads", () => {
    assert.match(commercialActionsSource, /session\.agencyModuleEnabled \|\| row\.audience !== "agency"/);
    assert.match(commercialActionsSource, /recordValue\(row\.metadata\)\.audience !== "agency"/);
    assert.match(commercialActionsSource, /override\?\.audience === "agency"/);
    assert.match(businessWorkspaceActionSource, /withoutAgencyModuleData/);
    assert.equal((inventoryActionsSource.match(/isAgencyInventoryMovement/g) || []).length >= 4, true);
  });
});
