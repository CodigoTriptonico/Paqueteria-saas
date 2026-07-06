import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ShipmentRow } from "@/app/actions/shipments";
import { shipmentLogisticsSteps, PENDING_FULL_BOX_STATUS } from "./shipment-display";
import {
  buildShipmentTimings,
  buildShipmentAuditTimings,
  formatActiveElapsed,
  formatGapSummary,
  formatShipmentDuration,
  formatShipmentRelative,
  formatWaitingHeadline,
  formatWaitingSince,
  resolveStepCompletedAt,
  saleAgeTextClass,
  saleAgeTone,
  stepShortName,
} from "./shipment-timing";

const NOW = Date.parse("2026-03-10T12:00:00.000Z");

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
    status: PENDING_FULL_BOX_STATUS,
    assigned_to: null,
    createdBy: "seller-1",
    salesOwnerId: "seller-1",
    salesOwnerName: "Seller",
    sale_kind: "full",
    invoice_status: "open",
    invoice_priority: false,
    accounting_status: "not_exportable",
    finalized_at: null,
    created_at: "2026-03-08T12:00:00.000Z",
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
        stockDeductedAt: "2026-03-08T12:30:00.000Z",
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
        status: "scheduled",
        assignedTo: null,
        scheduledAt: "2026-03-11T10:00:00.000Z",
        warehouseId: null,
        notes: "",
        stockDeductedAt: null,
        completedAt: null,
        orderedAt: "2026-03-09T08:00:00.000Z",
        assignedAt: null,
        loadedAt: null,
        createdAt: "2026-03-08T12:00:00.000Z",
      },
    ],
    payments: [],
    ...overrides,
  };
}

describe("shipment-timing", () => {
  it("formats durations in full Spanish", () => {
    assert.equal(formatShipmentDuration(30_000), "inmediato");
    assert.equal(formatShipmentDuration(45 * 60_000), "45 min");
    assert.equal(formatShipmentDuration(2 * 60 * 60_000), "2 horas");
    assert.equal(formatShipmentDuration(3 * 24 * 60 * 60_000), "3 días");
    assert.equal(formatShipmentDuration(1 * 24 * 60 * 60_000), "1 día");
    assert.equal(formatShipmentDuration(1 * 60 * 60_000), "1 hora");
  });

  it("formats relative sale age with full words", () => {
    assert.equal(
      formatShipmentRelative("2026-03-08T12:00:00.000Z", NOW),
      "hace 2 días",
    );
  });

  it("uses short step names for gaps", () => {
    assert.equal(stepShortName("full_box"), "Recoger");
    assert.equal(
      formatGapSummary({
        fromKind: "sale",
        toKind: "empty_box",
        durationMs: 30_000,
        label: "inmediato",
      }),
      "Venta → dejar · inmediato",
    );
    assert.equal(
      formatActiveElapsed("3 días", "empty_box"),
      "3 días desde dejar",
    );
    assert.equal(formatWaitingHeadline("3 días"), "Lleva 3 días");
    assert.equal(formatWaitingSince("empty_box"), "desde dejar");
  });

  it("resolves step timestamps from milestone columns", () => {
    const row = baseShipment({
      office_received_at: "2026-03-09T10:00:00.000Z",
      full_box_collected_at: "2026-03-09T10:00:00.000Z",
    });

    assert.equal(resolveStepCompletedAt(row, "sale"), row.created_at);
    assert.equal(resolveStepCompletedAt(row, "empty_box"), row.empty_box_delivered_at);
    assert.equal(resolveStepCompletedAt(row, "full_box"), row.full_box_collected_at);
    assert.equal(resolveStepCompletedAt(row, "office"), row.office_received_at);
  });

  it("builds readable timing block for active recoleccion", () => {
    const row = baseShipment();
    const steps = shipmentLogisticsSteps(row);
    const timings = buildShipmentTimings(row, steps, NOW);

    assert.equal(timings.saleAgeLabel, "Venta hace 2 días");
    assert.equal(timings.completedGapsLine, "Venta → dejar · 30 min");
    assert.equal(timings.lastCompletedGap, "Venta → dejar · 30 min");
    assert.equal(timings.progressStepLabel, "Paso 2 de 4");
    assert.equal(timings.activeStepShortName, "Recoger");
    assert.equal(timings.waitingHeadline, "Lleva 2 días");
    assert.equal(timings.waitingSinceLabel, "desde dejar");
    assert.equal(timings.waitingText, "Lleva 2 días desde dejar");
    assert.equal(timings.activeElapsedDetail, "2 días desde dejar");
    assert.equal(timings.isLongWait, true);
    assert.equal(steps.find((step) => step.state === "active")?.title, "Recoger");
  });

  it("omits completed line when milestone data is missing", () => {
    const row = baseShipment({
      empty_box_delivered_at: null,
      logistics_plan: {
        emptyBox: { mode: "Programar entrega de caja vacia" },
        fullBox: { mode: "Programar recoleccion caja llena" },
      },
      logisticsTasks: [
        {
          id: "task-1",
          shipmentId: "shipment-1",
          taskType: "deliver_empty_box",
          status: "scheduled",
          assignedTo: null,
          scheduledAt: "2026-03-11T10:00:00.000Z",
          warehouseId: null,
          notes: "",
          stockDeductedAt: null,
        completedAt: null,
        orderedAt: null,
        assignedAt: null,
        loadedAt: null,
        createdAt: "2026-03-08T12:00:00.000Z",
        },
      ],
    });
    const steps = shipmentLogisticsSteps(row);
    const timings = buildShipmentTimings(row, steps, NOW);

    assert.equal(timings.completedGapsLine, null);
    assert.equal(timings.waitingHeadline, "Lleva 2 días");
    assert.equal(timings.waitingSinceLabel, "desde la venta");
    assert.equal(timings.waitingText, "Lleva 2 días desde la venta");
  });

  it("joins newly started wait copy in one visual phrase", () => {
    const row = baseShipment({
      created_at: "2026-03-10T12:00:00.000Z",
      empty_box_delivered_at: null,
      logistics_plan: {
        emptyBox: { mode: "Programar entrega de caja vacia" },
        fullBox: { mode: "Programar recoleccion caja llena" },
      },
      logisticsTasks: [
        {
          id: "task-1",
          shipmentId: "shipment-1",
          taskType: "deliver_empty_box",
          status: "scheduled",
          assignedTo: null,
          scheduledAt: "2026-03-11T10:00:00.000Z",
          warehouseId: null,
          notes: "",
        stockDeductedAt: null,
        completedAt: null,
        orderedAt: null,
        assignedAt: null,
        loadedAt: null,
        createdAt: "2026-03-10T12:00:00.000Z",
        },
      ],
    });
    const steps = shipmentLogisticsSteps(row);
    const timings = buildShipmentTimings(row, steps, NOW);

    assert.equal(timings.waitingHeadline, "Recién iniciado");
    assert.equal(timings.waitingSinceLabel, "desde la venta");
    assert.equal(timings.waitingText, "Recién iniciado desde la venta");
  });

  it("builds gaps from status milestone columns through delivery", () => {
    const row = baseShipment({
      status: "Entregado",
      full_box_collected_at: "2026-03-09T08:00:00.000Z",
      office_received_at: "2026-03-09T08:00:00.000Z",
      departed_at: "2026-03-09T14:00:00.000Z",
      shipped_at: "2026-03-09T18:00:00.000Z",
      delivered_at: "2026-03-10T10:00:00.000Z",
      logistics_plan: {
        emptyBox: {
          mode: "Cliente recoge caja vacia en oficina",
          handingNow: true,
          stockDeductedAt: "2026-03-08T12:30:00.000Z",
        },
        fullBox: { mode: "Programar recoleccion caja llena" },
      },
    });
    const steps = shipmentLogisticsSteps(row);
    const timings = buildShipmentTimings(row, steps, NOW);

    const fullBoxToPickupGap = timings.gaps.find(
      (gap) => gap.fromKind === "full_box" && gap.toKind === "pickup",
    );
    const deliveredGap = timings.gaps.find(
      (gap) => gap.fromKind === "pickup" && gap.toKind === "delivered",
    );

    assert.equal(fullBoxToPickupGap?.label, "6 horas");
    assert.equal(deliveredGap?.label, "20 horas");
  });

  it("builds logistics leg audit timings from ordered to completed", () => {
    const row = baseShipment({
      logisticsTasks: [
        {
          id: "task-1",
          shipmentId: "shipment-1",
          taskType: "pickup_full_box",
          status: "completed",
          assignedTo: "driver-1",
          scheduledAt: "2026-03-11T10:00:00.000Z",
          warehouseId: null,
          notes: "",
          stockDeductedAt: null,
          completedAt: "2026-03-11T16:00:00.000Z",
          orderedAt: "2026-03-09T08:00:00.000Z",
          assignedAt: "2026-03-10T09:00:00.000Z",
          loadedAt: "2026-03-11T08:00:00.000Z",
          createdAt: "2026-03-09T08:00:00.000Z",
        },
      ],
    });
    const audit = buildShipmentAuditTimings(row, shipmentLogisticsSteps(row), NOW);

    assert.equal(audit.fullBoxLeg?.orderToCompleteLabel, "2 días");
    assert.match(audit.logisticsGapsLine || "", /ordenada/i);
    assert.match(audit.logisticsGapsLine || "", /completada/i);
  });
});

describe("saleAgeTone", () => {
  const HOUR = 60 * 60_000;
  const DAY = 24 * HOUR;

  it("ramps color tone as sale age increases", () => {
    assert.equal(saleAgeTone(5 * 60_000), "fresh");
    assert.equal(saleAgeTone(2 * HOUR), "recent");
    assert.equal(saleAgeTone(22 * HOUR), "aging");
    assert.equal(saleAgeTone(36 * HOUR), "stale");
    assert.equal(saleAgeTone(3 * DAY), "urgent");
  });

  it("maps each tone to a readable text class", () => {
    assert.equal(saleAgeTextClass(30 * 60_000), "text-slate-500");
    assert.equal(saleAgeTextClass(3 * HOUR), "text-slate-400");
    assert.equal(saleAgeTextClass(22 * HOUR), "text-slate-300");
    assert.equal(saleAgeTextClass(36 * HOUR), "text-amber-400");
    assert.equal(saleAgeTextClass(4 * DAY), "text-amber-300");
  });
});
