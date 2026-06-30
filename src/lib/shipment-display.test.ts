import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ShipmentRow } from "@/app/actions/shipments";
import { shipmentLogisticsSteps, shipmentOperationalStatusLabel, shipmentPaymentProgress } from "./shipment-display";

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
    created_at: "2026-03-08T12:00:00.000Z",
    finalized_at: null,
    empty_box_delivered_at: "2026-03-08T12:30:00.000Z",
    full_box_collected_at: null,
    office_received_at: null,
    departed_at: null,
    shipped_at: null,
    delivered_at: null,
    delivery_notes:
      "Caja vacia: Caja vacia entregada en mostrador | Caja llena: Cliente trae caja llena a oficina",
    logistics_plan: {
      emptyBox: {
        mode: "Cliente recoge caja vacia en oficina",
        handingNow: true,
      },
      fullBox: {
        mode: "Cliente trae caja llena a oficina",
      },
    },
    logisticsTasks: [],
    ...overrides,
  };
}

describe("shipmentLogisticsSteps", () => {
  it("marks counter delivery done and office drop-off as next step", () => {
    const steps = shipmentLogisticsSteps(baseShipment());

    assert.equal(steps.length, 7);
    assert.equal(steps[0]?.title, "Venta");
    assert.equal(steps[0]?.state, "done");
    assert.equal(steps[1]?.title, "Entrega de caja vacía");
    assert.equal(steps[1]?.state, "done");
    assert.equal(steps[1]?.channel, "office");
    assert.equal(steps[1]?.channelLabel, "Mostrador");
    assert.match(steps[1]?.detail ?? "", /mostrador/i);
    assert.equal(steps[2]?.title, "Recolección de caja llena");
    assert.equal(steps[2]?.state, "active");
    assert.equal(steps[2]?.channel, "office");
    assert.match(steps[2]?.detail ?? "", /oficina/i);
    assert.equal(steps[3]?.title, "En oficina");
    assert.equal(steps[6]?.title, "Entregado");
    assert.equal(steps.some((step) => step.title === "Cobro"), false);
  });

  it("tracks payment progress independently from logistics", () => {
    const quote = { label: "14x14x14", paid: "$200", cost: "$0", total: "$200" };
    const progress = shipmentPaymentProgress(
      baseShipment({
        paid: 20,
        logistics_plan: {
          emptyBox: { mode: "Cliente recoge caja vacia en oficina", handingNow: true },
          fullBox: { mode: "Cliente trae caja llena a oficina" },
          billing: {
            quotedTotal: "$200",
            payNow: "$20",
            balanceDue: "$180",
          },
        },
      }),
      quote,
    );

    assert.equal(progress.total, 200);
    assert.equal(progress.paid, 20);
    assert.equal(progress.pending, 180);
    assert.equal(progress.status, "partial");
    assert.equal(progress.percentPaid, 10);
  });

  it("shows home pickup when full box uses driver collection", () => {
    const steps = shipmentLogisticsSteps(
      baseShipment({
        logistics_plan: {
          emptyBox: {
            mode: "Cliente recoge caja vacia en oficina",
            handingNow: true,
          },
          fullBox: {
            mode: "Programar recoleccion caja llena",
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
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    );

    assert.equal(steps[2]?.state, "active");
    assert.equal(steps[2]?.channel, "home");
    assert.equal(steps[2]?.channelLabel, "Domicilio");
    assert.match(steps[2]?.detail ?? "", /domicilio/i);
  });

  it("marks transit steps done when shipment is delivered", () => {
    const steps = shipmentLogisticsSteps(
      baseShipment({
        status: "Entregado",
        invoice_status: "paid",
        logistics_plan: {
          emptyBox: {
            mode: "Cliente recoge caja vacia en oficina",
            handingNow: true,
          },
          fullBox: {
            mode: "Cliente trae caja llena a oficina",
          },
          billing: {
            quotedTotal: "$200",
            payNow: "$20",
            balanceDue: "$0",
          },
        },
      }),
    );

    assert.equal(steps.every((step) => step.state === "done"), true);
  });
});

describe("shipmentOperationalStatusLabel", () => {
  it("shows pending pickup when full box collection is the active step", () => {
    const label = shipmentOperationalStatusLabel(baseShipment());

    assert.equal(label, "Pendiente por recoger");
  });

  it("shows pending delivery when empty box delivery is still active", () => {
    const label = shipmentOperationalStatusLabel(
      baseShipment({
        logistics_plan: {
          emptyBox: {
            mode: "Programar entrega de caja vacia",
          },
          fullBox: {
            mode: "Cliente trae caja llena a oficina",
          },
        },
        logisticsTasks: [
          {
            id: "task-1",
            shipmentId: "shipment-1",
            taskType: "deliver_empty_box",
            status: "pending",
            assignedTo: null,
            scheduledAt: null,
            warehouseId: null,
            notes: "",
            stockDeductedAt: null,
            completedAt: null,
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    );

    assert.equal(label, "Pendiente por entregar");
  });

  it("shows pending delivery when shipment is waiting for final delivery", () => {
    const label = shipmentOperationalStatusLabel(
      baseShipment({
        status: "Enviado",
        logistics_plan: {
          emptyBox: {
            mode: "Cliente recoge caja vacia en oficina",
            handingNow: true,
          },
          fullBox: {
            mode: "Cliente trae caja llena a oficina",
          },
        },
      }),
    );

    assert.equal(label, "Pendiente por entregar");
  });
});
