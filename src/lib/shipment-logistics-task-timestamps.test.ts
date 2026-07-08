import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isLogisticsTaskReactivation,
  logisticsTaskAssignedPatch,
  logisticsTaskCancelPatch,
  logisticsTaskOrderInsertPatch,
  logisticsTaskReactivatePatch,
  logisticsTaskReactivatePatchPreservingStock,
} from "@/lib/shipment-logistics-task-timestamps";

describe("shipment logistics task timestamps", () => {
  it("creates order insert patch", () => {
    assert.deepEqual(logisticsTaskOrderInsertPatch("2026-07-05T10:00:00.000Z"), {
      ordered_at: "2026-07-05T10:00:00.000Z",
    });
  });

  it("clears phase timestamps on cancel", () => {
    assert.deepEqual(logisticsTaskCancelPatch(), {
      ordered_at: null,
      assigned_at: null,
      loaded_at: null,
    });
  });

  it("resets cycle timestamps on reactivation", () => {
    assert.deepEqual(logisticsTaskReactivatePatch("2026-07-05T11:00:00.000Z"), {
      ordered_at: "2026-07-05T11:00:00.000Z",
      assigned_at: null,
      loaded_at: null,
      completed_at: null,
      stock_deducted_at: null,
    });
  });

  it("writes assigned_at only once", () => {
    const patch = logisticsTaskAssignedPatch({ orderedAt: null, assignedAt: null, loadedAt: null });
    assert.equal(typeof patch.assigned_at, "string");

    assert.deepEqual(
      logisticsTaskAssignedPatch({
        orderedAt: "2026-01-01T00:00:00.000Z",
        assignedAt: "2026-01-02T00:00:00.000Z",
        loadedAt: null,
      }),
      {},
    );
  });

  it("detects cancelled task reactivation", () => {
    assert.equal(
      isLogisticsTaskReactivation({
        id: "t1",
        shipmentId: "s1",
        taskType: "pickup_full_box",
        status: "cancelled",
        assignedTo: null,
        scheduledAt: null,
        warehouseId: null,
        notes: "",
        stockDeductedAt: null,
        completedAt: null,
        orderedAt: null,
        assignedAt: null,
        loadedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
      true,
    );
  });

  it("preserves stock deduction on reactivation patch", () => {
    const patch = logisticsTaskReactivatePatchPreservingStock(
      { stockDeductedAt: "2026-07-08T10:00:00.000Z" },
      "2026-07-08T12:00:00.000Z",
    );

    assert.equal(patch.stock_deducted_at, "2026-07-08T10:00:00.000Z");
    assert.equal(patch.ordered_at, "2026-07-08T12:00:00.000Z");
    assert.equal(patch.assigned_at, null);
  });
});
