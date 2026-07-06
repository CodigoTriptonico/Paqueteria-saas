import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ShipmentRow } from "@/app/actions/shipments";
import {
  buildUpdatedLogisticsPlan,
  emptyBoxLegLocked,
  fullBoxLegLocked,
  logisticsTaskSyncPlan,
  validateLogisticsPlanUpdate,
} from "./shipment-logistics-edit";
import {
  EMPTY_BOX_DRIVER_MODE,
  EMPTY_BOX_OFFICE_MODE,
  FULL_BOX_DRIVER_MODE,
  FULL_BOX_OFFICE_MODE,
} from "@/components/sale/venta-parts";
import { PENDING_EMPTY_BOX_STATUS } from "./shipment-display";

function baseShipment(overrides: Partial<ShipmentRow> = {}): ShipmentRow {
  return {
    id: "shipment-1",
    code: "INV-000001",
    customerId: null,
    recipientId: null,
    recipientSnapshot: null,
    customer_name: "Sandra Ruiz",
    country: "Mexico",
    carrier: "14x14x14 x1",
    paid: 20,
    profit: 0,
    status: PENDING_EMPTY_BOX_STATUS,
    assigned_to: null,
    createdBy: "seller-1",
    salesOwnerId: "seller-1",
    salesOwnerName: "Seller",
    sale_kind: "full",
    invoice_status: "open",
    invoice_priority: false,
    accounting_status: "not_exportable",
    created_at: null,
    finalized_at: null,
    empty_box_delivered_at: null,
    full_box_collected_at: null,
    office_received_at: null,
    departed_at: null,
    shipped_at: null,
    delivered_at: null,
    delivery_notes: "",
    logistics_plan: {
      emptyBox: {
        mode: EMPTY_BOX_OFFICE_MODE,
        handingNow: true,
        stockDeductedAt: "2026-01-01T00:00:00.000Z",
      },
      fullBox: {
        mode: FULL_BOX_OFFICE_MODE,
      },
    },
    logisticsTasks: [],
    payments: [],
    ...overrides,
  };
}

describe("shipment-logistics-edit", () => {
  it("locks empty box after counter delivery", () => {
    assert.equal(emptyBoxLegLocked(baseShipment()), true);
    assert.equal(fullBoxLegLocked(baseShipment()), false);
  });

  it("blocks changing locked empty box mode", () => {
    const error = validateLogisticsPlanUpdate(baseShipment(), {
      emptyBox: {
        mode: EMPTY_BOX_DRIVER_MODE,
        handingNow: false,
        scheduleMode: "pending",
        scheduleAt: null,
      },
      fullBox: {
        mode: FULL_BOX_OFFICE_MODE,
        scheduleMode: "pending",
        scheduleAt: null,
      },
    });

    assert.match(error, /mostrador/i);
  });

  it("rebuilds delivery notes when switching full box to driver pickup", () => {
    const row = baseShipment({
      logistics_plan: {
        emptyBox: {
          mode: EMPTY_BOX_OFFICE_MODE,
          handingNow: true,
          stockDeductedAt: "2026-01-01T00:00:00.000Z",
        },
        fullBox: {
          mode: FULL_BOX_OFFICE_MODE,
        },
        notes: "",
      },
    });

    const { deliveryNotes, logisticsPlan } = buildUpdatedLogisticsPlan(row, {
      emptyBox: {
        mode: EMPTY_BOX_OFFICE_MODE,
        handingNow: true,
      },
      fullBox: {
        mode: FULL_BOX_DRIVER_MODE,
        scheduleMode: "pending",
        scheduleAt: null,
      },
    });

    assert.equal(logisticsPlan.driverTaskCount, 1);
    assert.match(deliveryNotes, /recoleccion caja llena/i);
  });

  it("allows cancelling a marked full box pickup", () => {
    const row = baseShipment({
      logistics_plan: {
        emptyBox: {
          mode: EMPTY_BOX_OFFICE_MODE,
          handingNow: true,
          stockDeductedAt: "2026-01-01T00:00:00.000Z",
        },
        fullBox: {
          mode: FULL_BOX_DRIVER_MODE,
          scheduleMode: "pending",
        },
      },
      logisticsTasks: [
        {
          id: "pickup-1",
          taskType: "pickup_full_box",
          status: "pending",
          scheduledAt: null,
          assignedTo: null,
          routeId: null,
          notes: "",
        },
      ],
    });

    const input = {
      emptyBox: {
        mode: EMPTY_BOX_OFFICE_MODE,
        handingNow: true,
        scheduleMode: "pending",
        scheduleAt: null,
      },
      fullBox: {
        mode: "",
        scheduleMode: "pending",
        scheduleAt: null,
      },
    };

    assert.equal(validateLogisticsPlanUpdate(row, input), "");

    const { logisticsPlan } = buildUpdatedLogisticsPlan(row, input);
    assert.equal(logisticsPlan.fullBox?.mode, "");
    assert.equal(logisticsPlan.fullBox?.deferred, true);
    assert.equal(logisticsPlan.driverTaskCount, 0);

    const pickup = logisticsTaskSyncPlan(row, input).find((spec) => spec.taskType === "pickup_full_box");
    assert.equal(pickup?.needed, false);
    assert.equal(pickup?.canMutate, true);
  });

  it("allows cancelling empty box delivery while full box pickup is still deferred", () => {
    const row = baseShipment({
      status: PENDING_EMPTY_BOX_STATUS,
      logistics_plan: {
        emptyBox: {
          mode: EMPTY_BOX_DRIVER_MODE,
          scheduleMode: "pending",
        },
        fullBox: {
          mode: "",
          deferred: true,
        },
      },
      logisticsTasks: [
        {
          id: "delivery-1",
          taskType: "deliver_empty_box",
          status: "pending",
          scheduledAt: null,
          assignedTo: null,
          routeId: null,
          notes: "",
        },
      ],
    });

    const input = {
      emptyBox: {
        mode: "",
        handingNow: false,
        scheduleMode: "pending",
        scheduleAt: null,
      },
      fullBox: {
        mode: "",
        scheduleMode: "pending",
        scheduleAt: null,
      },
    };

    assert.equal(validateLogisticsPlanUpdate(row, input), "");

    const { logisticsPlan } = buildUpdatedLogisticsPlan(row, input);
    assert.equal(logisticsPlan.emptyBox?.mode, "");
    assert.equal(logisticsPlan.emptyBox?.deferred, true);
    assert.equal(logisticsPlan.fullBox?.mode, "");

    const delivery = logisticsTaskSyncPlan(row, input).find(
      (spec) => spec.taskType === "deliver_empty_box",
    );
    assert.equal(delivery?.needed, false);
  });

  it("creates pickup task spec when marking deferred full box pickup ready", () => {
    const row = baseShipment({
      logistics_plan: {
        emptyBox: {
          mode: EMPTY_BOX_OFFICE_MODE,
          handingNow: true,
          stockDeductedAt: "2026-01-01T00:00:00.000Z",
        },
        fullBox: {
          mode: "",
          deferred: true,
        },
      },
    });

    const taskSync = logisticsTaskSyncPlan(row, {
      emptyBox: {
        mode: EMPTY_BOX_OFFICE_MODE,
        handingNow: true,
      },
      fullBox: {
        mode: FULL_BOX_DRIVER_MODE,
        scheduleMode: "pending",
        scheduleAt: null,
        driverTaskOrdered: true,
      },
    });

    const pickup = taskSync.find((spec) => spec.taskType === "pickup_full_box");
    assert.equal(pickup?.needed, true);
    assert.equal(pickup?.scheduleMode, "pending");
  });

  it("creates driver task when applying a scheduled date", () => {
    const row = baseShipment({
      status: PENDING_EMPTY_BOX_STATUS,
      logistics_plan: {
        emptyBox: {
          mode: EMPTY_BOX_DRIVER_MODE,
          scheduleMode: "pending",
        },
        fullBox: {
          mode: "",
          deferred: true,
        },
      },
    });

    const scheduleAndOrder = logisticsTaskSyncPlan(row, {
      emptyBox: {
        mode: EMPTY_BOX_DRIVER_MODE,
        scheduleMode: "scheduled",
        scheduleAt: "2026-07-10T10:00:00",
        driverTaskOrdered: true,
      },
      fullBox: {
        mode: "",
        scheduleMode: "pending",
        scheduleAt: null,
        driverTaskOrdered: false,
      },
    });

    const delivery = scheduleAndOrder.find((spec) => spec.taskType === "deliver_empty_box");
    assert.equal(delivery?.needed, true);
    assert.equal(delivery?.scheduleMode, "scheduled");
    assert.equal(delivery?.scheduleAt, "2026-07-10T10:00:00");

    const scheduleOnly = logisticsTaskSyncPlan(row, {
      emptyBox: {
        mode: EMPTY_BOX_DRIVER_MODE,
        scheduleMode: "scheduled",
        scheduleAt: "2026-07-10T10:00:00",
        driverTaskOrdered: false,
      },
      fullBox: {
        mode: "",
        scheduleMode: "pending",
        scheduleAt: null,
        driverTaskOrdered: false,
      },
    });

    assert.equal(
      scheduleOnly.find((spec) => spec.taskType === "deliver_empty_box")?.needed,
      false,
    );
  });
});
