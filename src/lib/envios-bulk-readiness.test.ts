import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ShipmentRow } from "@/app/actions/shipments";
import {
  canApplyEnviosBulkReadiness,
  resolveEnviosBulkReadinessPatch,
} from "@/lib/envios-bulk-readiness";
import { PENDING_EMPTY_BOX_STATUS } from "@/lib/shipment-display";

function baseShipment(overrides: Partial<ShipmentRow> = {}): ShipmentRow {
  return {
    id: "shipment-1",
    code: "INV-000001",
    customer_name: "Cliente",
    customerPhone: "",
    customerSearchText: "",
    country: "México",
    carrier: "",
    status: PENDING_EMPTY_BOX_STATUS,
    salesOwnerId: "owner-1",
    salesOwnerName: "Owner",
    delivery_notes: "",
    invoice_status: "open",
    invoice_priority: false,
    accounting_status: "open",
    paid: 0,
    recipientSnapshot: {},
    logistics_plan: {},
    logisticsTasks: [],
    payments: [],
    contactLogs: [],
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("envios bulk readiness", () => {
  it("builds a mark patch for pending home delivery legs", () => {
    const row = baseShipment({
      logistics_plan: {
        emptyBox: {
          mode: "Programar entrega de caja vacia",
          driverTaskOrdered: false,
        },
        fullBox: {
          mode: "Programar recoleccion caja llena",
        },
      },
    });

    assert.deepEqual(resolveEnviosBulkReadinessPatch(row, "mark"), {
      emptyBoxMode: "Programar entrega de caja vacia",
      emptyBoxDriverTaskOrdered: true,
      emptyBoxScheduleMode: "pending",
      emptyBoxScheduleAt: "",
      emptyBoxHandingNow: false,
    });
    assert.equal(canApplyEnviosBulkReadiness(row, "mark"), true);
    assert.equal(canApplyEnviosBulkReadiness(row, "unmark"), false);
  });

  it("builds an unmark patch for ordered home pickup legs", () => {
    const row = baseShipment({
      status: "Pendiente recolección caja llena",
      empty_box_delivered_at: "2026-03-08T12:30:00.000Z",
      logistics_plan: {
        emptyBox: {
          mode: "Cliente recoge caja vacia en oficina",
          handingNow: true,
        },
        fullBox: {
          mode: "Programar recoleccion caja llena",
          driverTaskOrdered: true,
        },
      },
      logisticsTasks: [
        {
          id: "task-1",
          shipmentId: "shipment-1",
          taskType: "pickup_full_box",
          status: "pending",
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
        },
      ],
    });

    assert.deepEqual(resolveEnviosBulkReadinessPatch(row, "unmark"), {
      fullBoxMode: "",
      fullBoxDriverTaskOrdered: false,
      fullBoxScheduleMode: "pending",
      fullBoxScheduleAt: "",
    });
    assert.equal(canApplyEnviosBulkReadiness(row, "unmark"), true);
    assert.equal(canApplyEnviosBulkReadiness(row, "mark"), false);
  });

  it("ignores office legs and already-applied actions", () => {
    const officeRow = baseShipment({
      logistics_plan: {
        emptyBox: {
          mode: "Cliente recoge caja vacia en oficina",
          handingNow: true,
        },
        fullBox: {
          mode: "Cliente trae caja llena a oficina",
        },
      },
    });

    assert.equal(resolveEnviosBulkReadinessPatch(officeRow, "mark"), null);
    assert.equal(resolveEnviosBulkReadinessPatch(officeRow, "unmark"), null);
  });
});
