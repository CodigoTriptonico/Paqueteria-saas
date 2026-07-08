import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isLogisticsFailedTask,
  logisticsReprogramStockNotice,
} from "@/lib/logistics-reprogram";

describe("logistics-reprogram", () => {
  it("detects failed tasks and stock notice", () => {
    assert.equal(isLogisticsFailedTask({ status: "cancelled" }), true);
    assert.equal(isLogisticsFailedTask({ status: "assigned" }), false);
    assert.match(
      logisticsReprogramStockNotice({ stockDeductedAt: "2026-07-08T10:00:00.000Z" }) || "",
      /ya salió de bodega/,
    );
    assert.equal(logisticsReprogramStockNotice({ stockDeductedAt: null }), null);
  });
});
