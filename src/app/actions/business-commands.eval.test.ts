import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "src/app/actions/business-commands.ts"), "utf8");

describe("business commands eval", () => {
  it("routes every critical mutation through one transactional RPC", () => {
    for (const rpc of [
      "transition_agency_status",
      "assign_agency_captor",
      "assign_captor_supervisor",
      "create_agency_sale",
      "confirm_agency_visit",
      "record_agency_payment",
      "reconcile_driver_settlement",
      "reverse_financial_event",
      "authorize_international_release",
    ]) {
      assert.match(source, new RegExp(`"${rpc}"`));
    }
    assert.match(source, /assertIdempotencyKey/);
    assert.doesNotMatch(source, /tenantId:/);
    assert.doesNotMatch(source, /createSupabaseAdminClient/);
  });
});
