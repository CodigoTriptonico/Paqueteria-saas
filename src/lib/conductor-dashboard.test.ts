import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ConductorDriverTask } from "@/lib/conductor-tasks";
import {
  conductorTaskAddressKey,
  summarizeConductorTasks,
} from "@/lib/conductor-dashboard";

function task(partial: Partial<ConductorDriverTask> & Pick<ConductorDriverTask, "id" | "taskType">): ConductorDriverTask {
  return {
    status: "assigned",
    scheduledAt: null,
    shipmentId: partial.shipmentId || "ship-1",
    warehouseId: partial.warehouseId ?? null,
    shipmentCode: partial.shipmentCode || "INV-1",
    customerName: partial.customerName || "Cliente",
    customerPhone: partial.customerPhone ?? null,
    country: "Mexico",
    routeId: partial.routeId ?? null,
    routeName: null,
    routeDate: null,
    stopOrder: partial.stopOrder ?? null,
    addressLine: partial.addressLine ?? null,
    zoneLabel: partial.zoneLabel ?? null,
    boxLines: partial.boxLines || [],
    boxSummary: partial.boxSummary || "",
    paid: partial.paid ?? 0,
    depositDue: partial.depositDue ?? 0,
    balanceDue: partial.balanceDue ?? 0,
    sortAt: "2026-07-06T12:00:00.000Z",
    ...partial,
  };
}

describe("summarizeConductorTasks", () => {
  it("counts deliveries, pickups and unique addresses", () => {
    const summary = summarizeConductorTasks([
      task({
        id: "t1",
        taskType: "deliver_empty_box",
        addressLine: "Calle 1 #10",
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
      }),
    ]);

    assert.deepEqual(summary, {
      deliverCount: 2,
      pickupCount: 2,
      addressCount: 3,
      totalTasks: 4,
    });
  });

  it("ignores tasks without address or zone", () => {
    const summary = summarizeConductorTasks([
      task({ id: "t1", taskType: "deliver_empty_box" }),
      task({ id: "t2", taskType: "pickup_full_box", addressLine: "Calle 2" }),
    ]);

    assert.equal(summary.addressCount, 1);
    assert.equal(summary.totalTasks, 2);
  });
});

describe("conductorTaskAddressKey", () => {
  it("prefers formatted address over zone", () => {
    assert.equal(
      conductorTaskAddressKey(
        task({
          id: "t1",
          taskType: "deliver_empty_box",
          addressLine: "Calle 3",
          zoneLabel: "Centro",
        }),
      ),
      "calle 3",
    );
  });
});
