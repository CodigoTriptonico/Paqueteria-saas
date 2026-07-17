import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { summarizePlatformOrganizations } from "@/lib/platform-console-summary";

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
