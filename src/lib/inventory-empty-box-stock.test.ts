import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  availableEmptyBoxStock,
  matchEmptyBoxQuoteLinesToStock,
  readEmptyBoxQuoteLinesFromPlan,
  shouldReserveEmptyBoxStockOnSale,
  withEmptyBoxStockReservedPlan,
} from "./inventory-empty-box-stock";

describe("inventory-empty-box-stock", () => {
  it("reads quote lines from logistics plan", () => {
    const lines = readEmptyBoxQuoteLinesFromPlan({
      boxLines: [{ label: "12x12x12", quantity: 2 }],
    });

    assert.equal(lines.length, 1);
    assert.equal(lines[0]?.label, "12x12x12");
    assert.equal(lines[0]?.quantity, 2);
  });

  it("requires reservation when sale has boxes and stock is not deducted", () => {
    assert.equal(
      shouldReserveEmptyBoxStockOnSale({
        boxLines: [{ label: "12x12x12", quantity: 1 }],
        emptyBox: { mode: "Programar entrega de caja vacia" },
      }),
      true,
    );
    assert.equal(
      shouldReserveEmptyBoxStockOnSale({
        boxLines: [{ label: "12x12x12", quantity: 1 }],
        emptyBox: { stockDeductedAt: "2026-01-01T00:00:00.000Z" },
      }),
      false,
    );
  });

  it("matches quote lines to stock rows using available stock", () => {
    const matches = matchEmptyBoxQuoteLinesToStock(
      [{ label: "12x12x12", quantity: 1 }],
      [
        {
          id: "stock-1",
          item_id: "item-1",
          stock: 10,
          reserved: 3,
          inventory_items: { id: "item-1", name: "Caja mediana", kind: "12x12x12" },
        },
      ],
    );

    assert.equal(matches[0]?.itemId, "item-1");
    assert.equal(matches[0]?.available, 7);
  });

  it("rejects sales when available stock is insufficient", () => {
    assert.throws(
      () =>
        matchEmptyBoxQuoteLinesToStock(
          [{ label: "12x12x12", quantity: 5 }],
          [
            {
              id: "stock-1",
              item_id: "item-1",
              stock: 10,
              reserved: 8,
              inventory_items: { id: "item-1", name: "Caja mediana", kind: "12x12x12" },
            },
          ],
        ),
      /Stock insuficiente/,
    );
  });

  it("stores reservation metadata on the logistics plan", () => {
    const next = withEmptyBoxStockReservedPlan(
      { emptyBox: { mode: "Programar entrega de caja vacia" } },
      { reservedAt: "2026-01-01T00:00:00.000Z", warehouseId: "wh-1" },
    );

    assert.equal(next.emptyBox.stockReservedAt, "2026-01-01T00:00:00.000Z");
    assert.equal(next.emptyBox.reservationWarehouseId, "wh-1");
  });

  it("computes available stock as stock minus reserved", () => {
    assert.equal(availableEmptyBoxStock({ stock: 100, reserved: 15 }), 85);
  });
});
