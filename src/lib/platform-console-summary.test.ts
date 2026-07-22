import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatPlatformExtraUserLimit,
  formatPlatformUserCount,
  formatPlatformWarehouseCount,
  formatPlatformWarehouseLimit,
  summarizePlatformOrganizations,
} from "@/lib/platform-console-summary";

describe("platform organization summary", () => {
  it("counts companies, statuses, users, and warehouses for the upper summary", () => {
    const summary = summarizePlatformOrganizations([
      { id: "a", is_active: true, user_count: 3, warehouse_count: 2 },
      { id: "b", is_active: false, user_count: 1, warehouse_count: 4 },
    ] as never);

    assert.deepEqual(summary, {
      total: 2,
      active: 1,
      inactive: 1,
      users: 4,
      warehouses: 6,
    });
  });
});

describe("platform console Spanish count labels", () => {
  it("uses singular when the count is 1", () => {
    assert.equal(formatPlatformUserCount(1), "1 usuario");
    assert.equal(formatPlatformWarehouseCount(1), "1 bodega");
    assert.equal(formatPlatformExtraUserLimit(1), "1 usuario extra");
    assert.equal(formatPlatformWarehouseLimit(1), "1 bodega permitida");
  });

  it("uses plural when the count is not 1", () => {
    assert.equal(formatPlatformUserCount(0), "0 usuarios");
    assert.equal(formatPlatformUserCount(3), "3 usuarios");
    assert.equal(formatPlatformWarehouseCount(2), "2 bodegas");
    assert.equal(formatPlatformExtraUserLimit(5), "5 usuarios extra");
    assert.equal(formatPlatformWarehouseLimit(3), "3 bodegas permitidas");
  });

  it("describes null plan limits as unlimited instead of a dash", () => {
    assert.equal(formatPlatformExtraUserLimit(null), "Sin límite de usuarios");
    assert.equal(formatPlatformWarehouseLimit(null), "Sin límite de bodegas");
  });
});
