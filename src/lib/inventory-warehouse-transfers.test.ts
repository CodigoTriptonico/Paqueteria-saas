import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  availableWarehouseTransferQty,
  countOpenIncomingTransfers,
  inventoryWarehouseTransferDirection,
  validateWarehouseTransferInput,
} from "./inventory-warehouse-transfers";

describe("inventory-warehouse-transfers", () => {
  it("computes available qty as stock minus reserved", () => {
    assert.equal(availableWarehouseTransferQty({ stock: 100, reserved: 15 }), 85);
    assert.equal(availableWarehouseTransferQty({ stock: 5, reserved: 20 }), 0);
  });

  it("classifies transfer direction for the active warehouse", () => {
    const transfer = {
      fromWarehouseId: "wh-a",
      toWarehouseId: "wh-b",
    };

    assert.equal(inventoryWarehouseTransferDirection(transfer, "wh-a"), "outgoing");
    assert.equal(inventoryWarehouseTransferDirection(transfer, "wh-b"), "incoming");
    assert.equal(inventoryWarehouseTransferDirection(transfer, "wh-c"), "other");
  });

  it("counts open incoming transfers", () => {
    const transfers = [
      {
        id: "1",
        fromWarehouseId: "wh-a",
        toWarehouseId: "wh-b",
        status: "in_transit" as const,
      },
      {
        id: "2",
        fromWarehouseId: "wh-c",
        toWarehouseId: "wh-b",
        status: "received" as const,
      },
      {
        id: "3",
        fromWarehouseId: "wh-a",
        toWarehouseId: "wh-b",
        status: "in_transit" as const,
      },
    ];

    assert.equal(countOpenIncomingTransfers(transfers as never, "wh-b"), 2);
  });

  it("validates transfer input", () => {
    assert.equal(
      validateWarehouseTransferInput({
        fromWarehouseId: "a",
        toWarehouseId: "a",
        itemId: "item",
        qty: 1,
        availableQty: 10,
      }).ok,
      false,
    );

    assert.equal(
      validateWarehouseTransferInput({
        fromWarehouseId: "a",
        toWarehouseId: "b",
        itemId: "item",
        qty: 20,
        availableQty: 10,
      }).ok,
      false,
    );

    assert.equal(
      validateWarehouseTransferInput({
        fromWarehouseId: "a",
        toWarehouseId: "b",
        itemId: "item",
        qty: 8,
        availableQty: 10,
      }).ok,
      true,
    );
  });
});
