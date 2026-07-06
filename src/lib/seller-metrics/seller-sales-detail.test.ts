import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSellerSalesDetailReport } from "@/lib/seller-metrics/seller-sales-detail";

function localIso(year: number, month: number, day: number, hour = 10) {
  return new Date(year, month - 1, day, hour, 0, 0, 0).toISOString();
}

describe("buildSellerSalesDetailReport", () => {
  it("filters by period, excludes void, and sorts by createdAt desc", () => {
    const report = buildSellerSalesDetailReport({
      sellerId: "ana",
      sellerName: "Ana",
      granularity: "day",
      anchor: new Date(2026, 6, 15, 12, 0, 0, 0),
      sales: [
        {
          id: "1",
          code: "INV-001",
          customerName: "Cliente A",
          country: "Mexico",
          paid: 100,
          profit: 30,
          invoiceStatus: "paid",
          status: "Pendiente recolección caja llena",
          saleKind: "full",
          createdAt: localIso(2026, 7, 15, 9),
          recipientName: "Dest A",
        },
        {
          id: "2",
          code: "INV-002",
          customerName: "Cliente B",
          country: "USA",
          paid: 25,
          profit: 0,
          invoiceStatus: "open",
          status: "Pendiente entrega caja vacía",
          saleKind: "empty_box_deposit",
          createdAt: localIso(2026, 7, 15, 16),
          recipientName: null,
        },
        {
          id: "3",
          code: "INV-OLD",
          customerName: "Cliente C",
          country: "USA",
          paid: 999,
          profit: 999,
          invoiceStatus: "paid",
          status: "Entregado",
          saleKind: "full",
          createdAt: localIso(2026, 7, 14, 9),
          recipientName: null,
        },
        {
          id: "4",
          code: "INV-VOID",
          customerName: "Cliente D",
          country: "USA",
          paid: 0,
          profit: 0,
          invoiceStatus: "void",
          status: "Pendiente recolección caja llena",
          saleKind: "full",
          createdAt: localIso(2026, 7, 15, 11),
          recipientName: null,
        },
      ],
    });

    assert.equal(report.sales.length, 2);
    assert.equal(report.sales[0]?.code, "INV-002");
    assert.equal(report.sales[1]?.code, "INV-001");
    assert.equal(report.totals.saleCount, 2);
    assert.equal(report.totals.openCount, 1);
    assert.equal(report.totals.closedCount, 1);
    assert.equal(report.totals.totalPaid, 125);
    assert.equal(report.totals.totalProfit, 30);
    assert.equal(report.totals.depositSales, 1);
    assert.equal(report.totals.fullSales, 1);
    assert.equal(report.sellerName, "Ana");
    assert.match(report.periodLabel, /15/);
  });
});
