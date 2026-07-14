import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ShipmentRow } from "@/app/actions/shipments";
import { shipmentLogisticsSteps, PENDING_FULL_BOX_STATUS } from "./shipment-display";
import {
  buildShipmentMilestoneAges,
  buildShipmentTimingInsightPanel,
  buildShipmentTimings,
  buildShipmentAuditTimings,
  formatActiveElapsed,
  formatGapSummary,
  formatShipmentDuration,
  formatShipmentRelative,
  formatWaitingHeadline,
  formatWaitingSince,
  milestoneAgeDisplayValue,
  milestoneAgeIndicatorButtonClass,
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

  it("builds milestone ages for sold, delivered, and waiting pickup", () => {
    const row = baseShipment();
    const steps = shipmentLogisticsSteps(row);
    const ages = buildShipmentMilestoneAges(row, steps, NOW);

    assert.deepEqual(
      ages.map((age) => age.key),
      ["sale", "empty_box", "full_box"],
    );
    assert.equal(ages[0]?.status, "done");
    assert.equal(ages[0]?.elapsedLabel, "hace 2 días");
    assert.equal(milestoneAgeDisplayValue(ages[0]!), "2 días");
    assert.equal(ages[1]?.status, "done");
    assert.equal(milestoneAgeDisplayValue(ages[1]!), "2 días");
    assert.equal(ages[2]?.status, "waiting");
    assert.equal(milestoneAgeDisplayValue(ages[2]!), "1 día");
    assert.equal(ages[2]?.detailLabel, "Recoger · lleva 1 día desde que se marcó");
  });

  it("marks undelivered milestones as pending until dejar is ordered", () => {
    const row = baseShipment({
      empty_box_delivered_at: null,
      full_box_collected_at: null,
      logistics_plan: {
        emptyBox: { mode: "Programar entrega de caja vacia" },
        fullBox: { mode: "Programar recoleccion caja llena" },
      },
      logisticsTasks: [],
    });
    const steps = shipmentLogisticsSteps(row);
    const ages = buildShipmentMilestoneAges(row, steps, NOW);

    assert.equal(ages[1]?.status, "pending");
    assert.equal(milestoneAgeDisplayValue(ages[1]!), "—");
    assert.equal(ages[1]?.detailLabel, "Dejar · sin marcar");
    assert.equal(ages[2]?.status, "pending");
  });

  it("starts dejar timer only after the leg is marked ready", () => {
    const row = baseShipment({
      created_at: "2026-03-10T11:39:00.000Z",
      empty_box_delivered_at: null,
      full_box_collected_at: null,
      logistics_plan: {
        emptyBox: {
          mode: "Programar entrega de caja vacia",
          driverTaskOrdered: true,
        },
        fullBox: { mode: "Programar recoleccion caja llena" },
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
          orderedAt: "2026-03-10T11:45:00.000Z",
          assignedAt: null,
          loadedAt: null,
          createdAt: "2026-03-10T11:45:00.000Z",
        },
      ],
    });
    const ages = buildShipmentMilestoneAges(row, shipmentLogisticsSteps(row), NOW);

    assert.equal(ages[1]?.status, "waiting");
    assert.equal(milestoneAgeDisplayValue(ages[1]!), "15 min");
    assert.equal(ages[1]?.detailLabel, "Dejar · lleva 15 min desde que se marcó");
  });

  it("uses Venta, Dejar and Recoger labels", () => {
    const row = baseShipment();
    const ages = buildShipmentMilestoneAges(row, shipmentLogisticsSteps(row), NOW);

    assert.deepEqual(
      ages.map((age) => age.label),
      ["Venta", "Dejar", "Recoger"],
    );
  });

  it("colors the indicator from the active waiting milestone", () => {
    const row = baseShipment();
    const ages = buildShipmentMilestoneAges(row, shipmentLogisticsSteps(row), NOW);

    assert.match(milestoneAgeIndicatorButtonClass(ages), /amber/);
  });

  it("builds a step-to-step timing insight panel", () => {
    const row = baseShipment();
    const insights = buildShipmentTimingInsightPanel(row, shipmentLogisticsSteps(row), NOW);

    assert.equal(insights[0]?.label, "Venta");
    assert.equal(insights[0]?.value, "2 días");
    assert.equal(
      insights.some((entry) => entry.label === "Venta → dejado" && entry.status === "done"),
      true,
    );
    assert.equal(
      insights.some(
        (entry) => entry.label === "Marcar recoger → recogido" && entry.status === "active",
      ),
      true,
    );
  });

  it("does not count dejar wait time after canceling a driver leg", () => {
    const row = baseShipment({
      created_at: "2026-07-11T17:54:00.000Z",
      empty_box_delivered_at: null,
      full_box_collected_at: null,
      status: "Pendiente entrega caja vacía",
      delivery_notes: "",
      logistics_plan: {
        emptyBox: {
          deferred: true,
          mode: "",
          driverTaskOrdered: false,
        },
        fullBox: {
          mode: "Programar recoleccion caja llena",
        },
      },
      logisticsTasks: [
        {
          id: "task-empty",
          shipmentId: "shipment-1",
          taskType: "deliver_empty_box",
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
          createdAt: "2026-07-11T17:54:00.000Z",
        },
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
          orderedAt: null,
          assignedAt: null,
          loadedAt: null,
          createdAt: "2026-03-08T12:00:00.000Z",
        },
      ],
    });
    const steps = shipmentLogisticsSteps(row);
    const now = Date.parse("2026-07-11T20:59:00.000Z");
    const insights = buildShipmentTimingInsightPanel(row, steps, now);
    const saleToEmpty = insights.find((entry) => entry.id === "sale-empty-done");
    const timings = buildShipmentTimings(row, steps, now);

    assert.equal(saleToEmpty?.status, "pending");
    assert.equal(saleToEmpty?.value, "—");
    assert.equal(timings.waitingText, null);
    assert.equal(timings.activeElapsedDetail, null);
  });

  it("shows pending gaps before dejar is marked", () => {
    const row = baseShipment({
      created_at: "2026-03-10T11:39:00.000Z",
      empty_box_delivered_at: null,
      full_box_collected_at: null,
      logistics_plan: {
        emptyBox: { mode: "Programar entrega de caja vacia" },
        fullBox: { mode: "Programar recoleccion caja llena" },
      },
      logisticsTasks: [],
    });
    const insights = buildShipmentTimingInsightPanel(row, shipmentLogisticsSteps(row), NOW);

    assert.equal(insights[0]?.value, "21 min");
    assert.deepEqual(
      insights
        .filter((entry) => entry.id !== "sale")
        .map((entry) => entry.value),
      ["—", "—", "—", "—"],
    );
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
