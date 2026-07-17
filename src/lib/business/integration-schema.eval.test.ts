import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/073_business_integration_reporting.sql"), "utf8");

describe("business integration eval", () => {
  it("leaves measurable zero-defect signals in the reporting contract", () => {
    assert.match(sql, /unbalancedJournalEntries/);
    assert.match(sql, /activeHolds/);
    assert.match(sql, /driverCashInTransitCents/);
    assert.match(sql, /unappliedAgencyPaymentsCents/);
    assert.match(sql, /availableMatrixBoxes/);
  });
});
