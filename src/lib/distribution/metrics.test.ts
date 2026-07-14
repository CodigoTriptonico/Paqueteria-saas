import assert from "node:assert/strict";
import test from "node:test";
import { buildDistributionMetricsReport } from "./metrics";

test("keeps a distributor sale assigned to the captor snapshot after reassignment", () => {
  const report = buildDistributionMetricsReport({
    partners: [{ id: "d1", name: "Distribuidor Uno", ownerId: "captor-new", ownerName: "Nuevo", isActive: true }],
    owners: [{ id: "captor-old", name: "Anterior" }, { id: "captor-new", name: "Nuevo" }],
    sales: [{ distribution_partner_id: "d1", distribution_acquisition_owner_id: "captor-old", distributor_wholesale_price: 150, created_at: "2026-07-14T10:00:00.000Z", invoice_status: "paid" }],
    ledger: [{ partner_id: "d1", kind: "charge", amount: 150, created_at: "2026-07-14T10:00:00.000Z" }],
    granularity: "day", anchor: new Date("2026-07-14T12:00:00.000Z"),
  });
  assert.equal(report.totals.internalSales, 150);
  assert.equal(report.captors.find((captor) => captor.id === "captor-new")?.saleCount, 0);
  assert.equal(report.captors.find((captor) => captor.id === "captor-old")?.saleCount, 1);
});

test("does not treat public distributor price as matrix revenue", () => {
  const report = buildDistributionMetricsReport({ partners: [], owners: [], sales: [], ledger: [], granularity: "day", anchor: new Date("2026-07-14T12:00:00.000Z") });
  assert.equal(report.totals.internalSales, 0);
});
