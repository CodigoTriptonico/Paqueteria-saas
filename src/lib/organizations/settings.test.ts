import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_MAX_WAREHOUSES,
  canEnableMultiWarehouseHub,
  getConfiguredWarehouseLimit,
  readMaxWarehouses,
} from "./settings";

describe("organization plan warehouse limits", () => {
  it("defaults every account to three warehouses when unset", () => {
    assert.equal(DEFAULT_MAX_WAREHOUSES, 3);
    assert.equal(readMaxWarehouses(undefined), 3);
    assert.equal(readMaxWarehouses({}), 3);
    assert.equal(getConfiguredWarehouseLimit({}), null);
  });

  it("respects an explicit plan limit", () => {
    assert.equal(readMaxWarehouses({ max_warehouses: 1 }), 1);
    assert.equal(readMaxWarehouses({ max_warehouses: 8 }), 8);
    assert.equal(canEnableMultiWarehouseHub({ max_warehouses: 3 }), true);
    assert.equal(canEnableMultiWarehouseHub({ max_warehouses: 1 }), false);
  });
});
