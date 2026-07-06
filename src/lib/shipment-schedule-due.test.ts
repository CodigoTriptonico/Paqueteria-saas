import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ShipmentRow } from "@/app/actions/shipments";
import {
  buildDueSchedulePromotionInput,
  isScheduledLegDue,
  legAwaitingScheduledAutoOrder,
} from "@/lib/shipment-schedule-due";

function baseShipment(overrides: Partial<ShipmentRow> = {}): ShipmentRow {
  return {
    id: "shipment-1",
    code: "INV-1",
    organization_id: "org-1",
    customer_id: null,
    customer_name: "Cliente",
    recipient_id: null,
    country: "MX",
    carrier: "DHL",
    paid: 0,
    profit: 0,
    cost: 0,
    status: "Pendiente caja vacía",
    sale_kind: "full",
    invoice_status: "open",
    accounting_status: "not_exportable",
    finalized_at: null,
    invoice_priority: false,
    sales_owner_id: null,
    assigned_to: null,
    delivery_notes: "",
    logistics_plan: {},
    logisticsTasks: [],
    empty_box_delivered_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as ShipmentRow;
}

describe("shipment-schedule-due", () => {
  const reference = new Date("2026-07-10T15:00:00");

  it("detects when a scheduled leg is due", () => {
    assert.equal(isScheduledLegDue("2026-07-10T10:00:00", reference), true);
    assert.equal(isScheduledLegDue("2026-07-11T10:00:00", reference), false);
    assert.equal(isScheduledLegDue("2026-07-10T16:00:00", reference), false);
  });

  it("waits to auto-order until the scheduled time arrives", () => {
    const row = baseShipment({
      logistics_plan: {
        emptyBox: {
          mode: "Programar entrega de caja vacia",
          scheduleMode: "scheduled",
          scheduleAt: "2026-07-11T10:00:00",
          driverTaskOrdered: false,
        },
        fullBox: { mode: "", deferred: true },
      },
    });

    assert.equal(
      legAwaitingScheduledAutoOrder(row, "emptyBox", "deliver_empty_box", reference),
      false,
    );
    assert.equal(buildDueSchedulePromotionInput(row, reference), null);
  });

  it("builds promotion input when a scheduled leg is due and not ordered", () => {
    const row = baseShipment({
      logistics_plan: {
        emptyBox: {
          mode: "Programar entrega de caja vacia",
          scheduleMode: "scheduled",
          scheduleAt: "2026-07-10T10:00:00",
          driverTaskOrdered: false,
        },
        fullBox: { mode: "", deferred: true },
      },
    });

    assert.equal(
      legAwaitingScheduledAutoOrder(row, "emptyBox", "deliver_empty_box", reference),
      true,
    );

    const input = buildDueSchedulePromotionInput(row, reference);
    assert.equal(input?.emptyBox.driverTaskOrdered, true);
    assert.equal(input?.emptyBox.scheduleMode, "scheduled");
    assert.equal(input?.emptyBox.scheduleAt, "2026-07-10T10:00:00");
  });
});
