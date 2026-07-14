import assert from "node:assert/strict";
import test from "node:test";
import { dashboardPeriodStart, distributionDashboardMetrics, isDistributionPartnerCreditBlocked } from "./dashboard";

const now = new Date("2026-07-14T12:00:00.000Z");

test("measures the matrix receivable without including distributor public prices", () => {
  const metrics = distributionDashboardMetrics([{
    id: "partner-a",
    creditLimit: 500,
    balance: 500,
    isActive: true,
    ledger: [
      { kind: "charge", amount: 150, createdAt: "2026-07-14T08:00:00.000Z" },
      { kind: "payment", amount: -50, createdAt: "2026-07-14T09:00:00.000Z" },
    ],
    shipmentsCreatedAt: ["2026-07-14T08:00:00.000Z"],
  }, {
    id: "partner-b",
    creditLimit: 400,
    balance: 125,
    isActive: false,
    ledger: [{ kind: "charge", amount: 125, createdAt: "2026-06-01T08:00:00.000Z" }],
    shipmentsCreatedAt: ["2026-06-01T08:00:00.000Z"],
  }], "today", now);

  assert.deepEqual(metrics, {
    activePartners: 1,
    pausedPartners: 1,
    blockedPartners: 1,
    totalDebt: 625,
    creditCommitted: 625,
    creditAvailable: 275,
    paymentsInPeriod: 50,
    internalSalesInPeriod: 150,
    activeShipmentsInPeriod: 1,
  });
});

test("uses inclusive calendar-period boundaries", () => {
  const start = dashboardPeriodStart("7d", now);
  assert.equal(start?.getFullYear(), 2026);
  assert.equal(start?.getMonth(), 6);
  assert.equal(start?.getDate(), 8);
  assert.equal(start?.getHours(), 0);
  assert.equal(isDistributionPartnerCreditBlocked({ creditLimit: 100, balance: 99, isActive: true }), false);
  assert.equal(isDistributionPartnerCreditBlocked({ creditLimit: 100, balance: 100, isActive: true }), true);
  assert.equal(isDistributionPartnerCreditBlocked({ creditLimit: 0, balance: 0, isActive: true }), false);
});
