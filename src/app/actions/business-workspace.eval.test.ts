import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "src/app/actions/business-workspace.ts"), "utf8");

describe("business workspace loader eval", () => {
  it("derives the organization from the authenticated server session", () => {
    assert.match(source, /requireAppSession/);
    assert.match(source, /target_organization_id: session\.organizationId/);
    assert.doesNotMatch(source, /createSupabaseAdminClient/);
    assert.doesNotMatch(source, /tenantId/);
  });
});
