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
const planUsageSource = readFileSync(
  join(process.cwd(), "src", "components", "config", "plan-usage-link.tsx"),
  "utf8",
);
const labelsSource = readFileSync(
  join(process.cwd(), "src", "lib", "config-section-labels.ts"),
  "utf8",
);

describe("organization management information architecture", () => {
  it("keeps one organization landing card for company access and warehouses", () => {
    assert.match(configSource, /id: "organization" as Section/);
    assert.match(labelsSource, /title: "Organización"/);
    assert.match(labelsSource, /usuarios, roles y bodegas/);
    assert.doesNotMatch(configSource, /id: "plan" as Section/);
    assert.doesNotMatch(configSource, /id: "company" as Section/);
    assert.doesNotMatch(configSource, /id: "users" as Section/);
  });

  it("keeps Empresa, Plan, Usuarios and Bodegas as clear internal tabs", () => {
    assert.match(managementSource, /label: "Empresa"/);
    assert.match(managementSource, /label: "Plan"/);
    assert.match(managementSource, /label: "Usuarios"/);
    assert.match(managementSource, /label: "Bodegas"/);
    assert.match(managementSource, /WarehousesSettingsPanel/);
    assert.match(managementSource, /"warehouses"/);
    assert.match(managementSource, /ariaLabel="Empresa, plan, usuarios y bodegas"/);
    assert.match(configSource, /isOrganizationManagementTab/);
    assert.match(planUsageSource, /WAREHOUSES_CONFIG_HREF/);
    assert.match(
      planUsageSource,
      /\/configuracion\?view=organization&tab=warehouses/,
    );
  });
});
