import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "src/app/actions/agency-operations.ts"), "utf8");

test("agency visit reads validate capability, organization and conductor role before service role queries", () => {
  assert.match(source, /canReadDriverAgencyVisits\(session, requestedDriverId\)/);
  assert.match(source, /\.eq\("organization_id", session\.organizationId\)/);
  assert.match(source, /\.eq\("roles\.slug", "conductor"\)/);
  assert.match(source, /\.eq\("assigned_to", requestedDriverId\)/);
});
