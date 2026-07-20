import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  emptyBusinessWorkspace,
  formatUsdCents,
  withoutAgencyModuleData,
} from "@/lib/business/workspace";

describe("business workspace", () => {
  it("starts without invented balances or operational rows", () => {
    const workspace = emptyBusinessWorkspace({
      tenantId: "tenant-1",
      tenantName: "Acme Logística",
      organizationId: "org-1",
      organizationName: "Acme Logística",
      organizationCode: "ACME",
      organizationType: "matrix",
    });
    assert.equal(workspace.agencies.length, 0);
    assert.equal(workspace.metrics.agencyReceivableCents, 0);
    assert.equal(workspace.metrics.unbalancedJournalEntries, 0);
  });

  it("formats integer cents without changing the stored value", () => {
    assert.equal(formatUsdCents(123_456), "$1,234.56");
  });

  it("removes every agency data surface when the module is disabled", () => {
    const workspace = emptyBusinessWorkspace({
      tenantId: "tenant-1",
      tenantName: "Acme",
      organizationId: "org-1",
      organizationName: "Acme",
      organizationCode: "ACME",
      organizationType: "matrix",
    });
    workspace.agencies.push({
      id: "agency-1",
      code: "AG-1",
      name: "Agency",
      status: "active",
      statusVersion: 1,
      captorName: null,
      openRequests: 2,
      chargeBalanceCents: 500,
    });
    workspace.metrics.agencyReceivableCents = 500;
    workspace.metrics.unappliedAgencyPaymentsCents = 300;
    workspace.metrics.unbalancedJournalEntries = 2;

    const hidden = withoutAgencyModuleData(workspace);

    assert.deepEqual(hidden.agencies, []);
    assert.deepEqual(hidden.requests, []);
    assert.deepEqual(hidden.holds, []);
    assert.equal(hidden.metrics.agencyReceivableCents, 0);
    assert.equal(hidden.metrics.unappliedAgencyPaymentsCents, 0);
    assert.equal(hidden.metrics.unbalancedJournalEntries, 2);
  });
});
