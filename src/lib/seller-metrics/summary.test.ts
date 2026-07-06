import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { aggregateSellerMetrics } from "@/lib/seller-metrics/summary";

function localIso(year: number, month: number, day: number, hour = 10) {
  return new Date(year, month - 1, day, hour, 0, 0, 0).toISOString();
}

describe("aggregateSellerMetrics", () => {
  const owners = [
    { id: "ana", label: "Ana" },
    { id: "bruno", label: "Bruno" },
  ];

  it("ranks sellers by registered sales and computes shares", () => {
    const report = aggregateSellerMetrics({
      owners,
      granularity: "day",
      anchor: new Date(2026, 6, 15, 12, 0, 0, 0),
      sales: [
        {
          salesOwnerId: "ana",
          salesOwnerName: "Ana",
          paid: 120,
          profit: 40,
          saleKind: "full",
          createdAt: localIso(2026, 7, 15, 9),
          invoiceStatus: "paid",
        },
        {
          salesOwnerId: "bruno",
          salesOwnerName: "Bruno",
          paid: 80,
          profit: 20,
          saleKind: "empty_box_deposit",
          createdAt: localIso(2026, 7, 15, 11),
          invoiceStatus: "paid",
        },
        {
          salesOwnerId: "ana",
          salesOwnerName: "Ana",
          paid: 30,
          profit: 10,
          saleKind: "full",
          createdAt: localIso(2026, 7, 15, 16),
          invoiceStatus: "paid",
        },
      ],
    });

    assert.equal(report.totals.saleCount, 3);
    assert.equal(report.totals.closedCount, 3);
    assert.equal(report.totals.openCount, 0);
    assert.equal(report.totals.totalPaid, 230);
    assert.equal(report.totals.totalProfit, 70);
    assert.equal(report.totals.activeSellers, 2);

    assert.equal(report.sellers[0]?.salesOwnerName, "Ana");
    assert.equal(report.sellers[0]?.saleCount, 2);
    assert.equal(report.sellers[0]?.totalPaid, 150);
    assert.equal(report.sellers[0]?.sharePercent, 66.66666666666666);
    assert.equal(report.sellers[0]?.averageTicket, 75);

    assert.equal(report.sellers[1]?.salesOwnerName, "Bruno");
    assert.equal(report.sellers[1]?.depositSales, 1);
    assert.equal(report.sellers[1]?.fullSales, 0);
  });

  it("counts open sales registered in the period", () => {
    const report = aggregateSellerMetrics({
      owners,
      granularity: "day",
      anchor: new Date(2026, 6, 1, 12, 0, 0, 0),
      sales: [
        {
          salesOwnerId: "ana",
          salesOwnerName: "Ana",
          paid: 25,
          profit: 0,
          saleKind: "full",
          createdAt: localIso(2026, 7, 1, 9),
          invoiceStatus: "open",
        },
        {
          salesOwnerId: "ana",
          salesOwnerName: "Ana",
          paid: 100,
          profit: 30,
          saleKind: "full",
          createdAt: localIso(2026, 7, 1, 15),
          invoiceStatus: "paid",
        },
      ],
    });

    assert.equal(report.totals.saleCount, 2);
    assert.equal(report.totals.openCount, 1);
    assert.equal(report.totals.closedCount, 1);
    assert.equal(report.totals.totalPaid, 125);
    assert.equal(report.sellers[0]?.openCount, 1);
    assert.equal(report.sellers[0]?.closedCount, 1);
  });

  it("keeps sellers with zero sales in the ranking", () => {
    const report = aggregateSellerMetrics({
      owners,
      granularity: "day",
      anchor: new Date(2026, 6, 15, 12, 0, 0, 0),
      sales: [
        {
          salesOwnerId: "ana",
          salesOwnerName: "Ana",
          paid: 50,
          profit: 10,
          saleKind: "full",
          createdAt: localIso(2026, 7, 15, 9),
          invoiceStatus: "paid",
        },
      ],
    });

    assert.equal(report.sellers.length, 2);
    assert.equal(report.sellers.find((row) => row.salesOwnerId === "bruno")?.saleCount, 0);
    assert.equal(report.totals.activeSellers, 1);
  });

  it("ignores sales outside the selected period", () => {
    const report = aggregateSellerMetrics({
      owners,
      granularity: "week",
      anchor: new Date(2026, 6, 15, 12, 0, 0, 0),
      sales: [
        {
          salesOwnerId: "ana",
          salesOwnerName: "Ana",
          paid: 100,
          profit: 30,
          saleKind: "full",
          createdAt: localIso(2026, 7, 15, 9),
          invoiceStatus: "paid",
        },
        {
          salesOwnerId: "bruno",
          salesOwnerName: "Bruno",
          paid: 999,
          profit: 999,
          saleKind: "full",
          createdAt: localIso(2026, 7, 20, 9),
          invoiceStatus: "open",
        },
      ],
    });

    assert.equal(report.totals.saleCount, 1);
    assert.equal(report.totals.totalPaid, 100);
    assert.equal(report.sellers.find((row) => row.salesOwnerId === "bruno")?.saleCount, 0);
  });

  it("ignores void sales", () => {
    const report = aggregateSellerMetrics({
      owners,
      granularity: "day",
      anchor: new Date(2026, 6, 15, 12, 0, 0, 0),
      sales: [
        {
          salesOwnerId: "ana",
          salesOwnerName: "Ana",
          paid: 0,
          profit: 0,
          saleKind: "full",
          createdAt: localIso(2026, 7, 15, 9),
          invoiceStatus: "void",
        },
      ],
    });

    assert.equal(report.totals.saleCount, 0);
  });

  it("builds a daily breakdown for the selected period", () => {
    const report = aggregateSellerMetrics({
      owners,
      granularity: "week",
      anchor: new Date(2026, 6, 15, 12, 0, 0, 0),
      sales: [
        {
          salesOwnerId: "ana",
          salesOwnerName: "Ana",
          paid: 40,
          profit: 10,
          saleKind: "full",
          createdAt: localIso(2026, 7, 13, 9),
          invoiceStatus: "open",
        },
        {
          salesOwnerId: "bruno",
          salesOwnerName: "Bruno",
          paid: 60,
          profit: 15,
          saleKind: "full",
          createdAt: localIso(2026, 7, 14, 9),
          invoiceStatus: "paid",
        },
      ],
    });

    assert.equal(report.dailyBreakdown.length, 7);
    assert.equal(report.dailyBreakdown[0]?.saleCount, 1);
    assert.equal(report.dailyBreakdown[0]?.openCount, 1);
    assert.equal(report.dailyBreakdown[0]?.totalPaid, 40);
    assert.equal(report.dailyBreakdown[1]?.saleCount, 1);
    assert.equal(report.dailyBreakdown[1]?.closedCount, 1);
    assert.equal(report.dailyBreakdown[1]?.totalPaid, 60);
  });
});
