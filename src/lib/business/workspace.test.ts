import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyBusinessWorkspace, formatUsdCents } from "@/lib/business/workspace";

describe("business workspace", () => {
  it("starts without invented balances or operational rows", () => {
    const workspace = emptyBusinessWorkspace({
      tenantId: "tenant-1",
      tenantName: "SCGS",
      organizationId: "org-1",
      organizationName: "SCGS",
      organizationCode: "SCGS",
      organizationType: "matrix",
    });
    assert.equal(workspace.agencies.length, 0);
    assert.equal(workspace.metrics.agencyReceivableCents, 0);
    assert.equal(workspace.metrics.unbalancedJournalEntries, 0);
  });

  it("formats integer cents without changing the stored value", () => {
    assert.equal(formatUsdCents(123_456), "$1,234.56");
  });
});
