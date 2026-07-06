import assert from "node:assert/strict";
import { describe, it } from "node:test";

function classifyStockRow(stock: number, minStock: number) {
  if (stock <= 0) {
    return "empty";
  }

  if (stock <= minStock) {
    return "low";
  }

  return "ok";
}

describe("inventario stats classification", () => {
  it("flags empty and low stock rows", () => {
    assert.equal(classifyStockRow(0, 2), "empty");
    assert.equal(classifyStockRow(2, 2), "low");
    assert.equal(classifyStockRow(5, 2), "ok");
  });
});
