import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isSalesOwnerRole,
  shipmentOwnershipInsert,
} from "@/lib/shipment-sales-owner";

describe("shipment sales owner", () => {
  it("stores creator and owner as current seller on insert", () => {
    assert.deepEqual(shipmentOwnershipInsert("seller-1"), {
      created_by: "seller-1",
      sales_owner_id: "seller-1",
    });
  });

  it("only allows admin and seller roles as owners", () => {
    assert.equal(isSalesOwnerRole("administrador"), true);
    assert.equal(isSalesOwnerRole("vendedor"), true);
    assert.equal(isSalesOwnerRole("conductor"), false);
  });
});
