import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const shipmentsSource = readFileSync(
  join(root, "src", "app", "actions", "shipments.ts"),
  "utf8",
);

describe("listShipmentsAction org scoping", () => {
  it("always filters by organization_id and applies pagination range", () => {
    assert.match(shipmentsSource, /\.eq\("organization_id", session\.organizationId\)/);
    assert.match(shipmentsSource, /\.range\(offset, offset \+ limit - 1\)/);
  });

  it("rollback deletes payments, releases reservations and reverses inventory salidas", () => {
    assert.match(shipmentsSource, /releaseInventorySaleStock/);
    assert.match(shipmentsSource, /reverseInventorySalidasForShipment/);
    assert.match(shipmentsSource, /from\("shipment_payments"\)/);
  });
});
