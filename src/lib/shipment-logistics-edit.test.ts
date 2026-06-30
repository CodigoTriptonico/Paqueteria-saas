import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ShipmentRow } from "@/app/actions/shipments";
import {
  buildUpdatedLogisticsPlan,
  emptyBoxLegLocked,
  fullBoxLegLocked,
  validateLogisticsPlanUpdate,
} from "./shipment-logistics-edit";
import {
  EMPTY_BOX_DRIVER_MODE,
  EMPTY_BOX_OFFICE_MODE,
  FULL_BOX_OFFICE_MODE,
} from "@/components/sale/venta-parts";

function baseShipment(overrides: Partial<ShipmentRow> = {}): ShipmentRow {
  return {
    id: "shipment-1",
    code: "INV-000001",
    customer_name: "Sandra Ruiz",
    country: "Mexico",
    carrier: "14x14x14 x1",
    paid: 20,
    profit: 0,
    status: "Pendiente",
    assigned_to: null,
    sale_kind: "full",
    invoice_status: "open",
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
        mode: "Programar recoleccion caja llena",
        scheduleMode: "pending",
        scheduleAt: null,
      },
    });

    assert.equal(logisticsPlan.driverTaskCount, 1);
    assert.match(deliveryNotes, /recoleccion caja llena/i);
  });
});
