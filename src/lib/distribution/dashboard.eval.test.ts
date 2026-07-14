import assert from "node:assert/strict";
import test from "node:test";
import { distributionDashboardMetrics } from "./dashboard";

test("dashboard keeps public pricing out of the matrix money totals", () => {
  const metrics = distributionDashboardMetrics([{
    id: "d1",
    creditLimit: 1_000,
    balance: 150,
    isActive: true,
    ledger: [{ kind: "charge", amount: 150, createdAt: "2026-07-14T00:00:00.000Z" }],
    shipmentsCreatedAt: ["2026-07-14T00:00:00.000Z"],
  }], "all", new Date("2026-07-14T12:00:00.000Z"));
  assert.equal(metrics.internalSalesInPeriod, 150);
  assert.equal(metrics.totalDebt, 150);
});
