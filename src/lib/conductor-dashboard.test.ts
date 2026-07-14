import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ConductorDriverTask } from "@/lib/conductor-tasks";
import { summarizeConductorCompletedOutcomes, summarizeConductorTasks } from "@/lib/conductor-dashboard";

function task(partial: Partial<ConductorDriverTask> & Pick<ConductorDriverTask, "id" | "taskType">): ConductorDriverTask {
  return {
    status: "assigned",
    scheduledAt: null,
    shipmentId: partial.shipmentId || "ship-1",
    warehouseId: partial.warehouseId ?? null,
    shipmentCode: partial.shipmentCode || "INV-1",
    senderName: partial.senderName || "Cliente",
    senderPhone: partial.senderPhone ?? null,
    recipientName: partial.recipientName ?? null,
    recipientCountry: partial.recipientCountry ?? null,
    recipientPhone: partial.recipientPhone ?? null,
    recipientCity: partial.recipientCity ?? null,
    routeId: partial.routeId ?? null,
    routeName: null,
    routeDate: null,
    stopOrder: partial.stopOrder ?? null,
    addressLine: partial.addressLine ?? null,
    zoneLabel: partial.zoneLabel ?? null,
    boxLines: partial.boxLines || [],
    boxSummary: partial.boxSummary || "",
    boxDisplayLines: partial.boxDisplayLines || [],
    boxTotal: partial.boxTotal || "",
    paid: partial.paid ?? 0,
    depositDue: partial.depositDue ?? 0,
    balanceDue: partial.balanceDue ?? 0,
    sortAt: "2026-07-06T12:00:00.000Z",
    ...partial,
  };
}

describe("summarizeConductorTasks", () => {
  it("counts delivery and pickup boxes separately", () => {
    const summary = summarizeConductorTasks([
      task({
        id: "t1",
        taskType: "deliver_empty_box",
        addressLine: "Calle 1 #10",
        boxLines: [
          { key: "box-a", catalogKey: "box-a", label: "14x14x14", quantity: 2 },
        ],
      }),
      task({
        id: "t2",
        taskType: "deliver_empty_box",
        addressLine: "Calle 1 #10",
      }),
      task({
        id: "t3",
        taskType: "pickup_full_box",
        addressLine: "Av. Central 22",
      }),
      task({
        id: "t4",
        taskType: "pickup_full_box",
        zoneLabel: "Zona norte",
        boxLines: [
          { key: "box-b", catalogKey: "box-b", label: "16x16x16", quantity: 3 },
        ],
      }),
    ]);

    assert.deepEqual(summary, {
      deliverCount: 3,
      pickupCount: 4,
      totalTasks: 4,
    });
  });
});

describe("summarizeConductorCompletedOutcomes", () => {
  it("counts successful and failed visits separately", () => {
    const summary = summarizeConductorCompletedOutcomes([
      task({
        id: "t1",
        taskType: "deliver_empty_box",
        status: "completed",
        boxLines: [{ key: "box-a", catalogKey: "box-a", label: "14x14x14", quantity: 2 }],
      }),
      task({
        id: "t2",
        taskType: "deliver_empty_box",
        status: "cancelled",
      }),
      task({
        id: "t3",
        taskType: "pickup_full_box",
        status: "cancelled",
        boxLines: [{ key: "box-b", catalogKey: "box-b", label: "16x16x16", quantity: 3 }],
      }),
    ]);

    assert.deepEqual(summary, {
      successCount: 1,
      failedCount: 2,
      successBoxes: 2,
      failedBoxes: 4,
    });
  });
});
