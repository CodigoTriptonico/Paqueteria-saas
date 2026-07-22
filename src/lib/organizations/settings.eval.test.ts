import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const settingsSource = readFileSync(join(root, "src/lib/organizations/settings.ts"), "utf8");
const platformSource = readFileSync(join(root, "src/app/actions/platform.ts"), "utf8");
const wizardSource = readFileSync(
  join(root, "src/components/platform/platform-create-client-wizard.tsx"),
  "utf8",
);
const migrationSource = readFileSync(
  join(root, "supabase/migrations/125_default_plan_three_warehouses.sql"),
  "utf8",
);

describe("default warehouse plan contract", () => {
  it("ships a three-warehouse base plan for new and unset accounts", () => {
    assert.match(settingsSource, /DEFAULT_MAX_WAREHOUSES = 3/);
    assert.match(platformSource, /DEFAULT_MAX_WAREHOUSES/);
    assert.match(wizardSource, /maxWarehouses: DEFAULT_MAX_WAREHOUSES/);
    assert.match(migrationSource, /max_warehouses.*3|'3'::jsonb/);
    assert.match(migrationSource, /lower\(o\.slug\) = 'scgs'/);
  });
});
