import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ShipmentRow } from "@/app/actions/shipments";
import {
  PENDING_EMPTY_BOX_STATUS,
  PENDING_FULL_BOX_STATUS,
  ENVIOS_STATUS_FILTER_OPTIONS,
  filterShipmentsForEnviosMode,
  isActiveShipment,
  isCompletedShipment,
  matchesEnviosSearchQuery,
  matchesEnviosStatusFilter,
  resolveInitialShipmentStatus,
  resolvePendingShipmentStatus,
  fullBoxPickupPlanStatus,
  fullBoxPickupPlanStatusLabel,
  shipmentLogisticsSteps,
  shipmentLogisticsBridgeLabel,
  SHIPMENT_LOGISTICS_BRIDGE_LABEL,
  shipmentOperationalAssignmentLabel,
  shipmentOperationalAssignment,
  shipmentOperationalDetailLabel,
  shipmentOperationalDriverLabel,
  shipmentOperationalStatusLabel,
  classifyEnviosReadinessBucket,
  matchesEnviosReadinessFilter,
  shipmentPaymentProgress,
  orderShipmentsByStableIds,
  reconcileShipmentDisplayOrderIds,
  sortShipmentsByArrivalOrder,
  sortShipmentsByInvoicePriority,
  syncShipmentStatusPatch,
  balanceDueFromShipment,
  depositFromShipment,
  formatBoxQuantityLabel,
  quoteFromShipment,
  readShipmentBoxLines,
  shipmentBoxLinesDetailLabel,
  shipmentBoxLinesTriggerLabel,
  shipmentBoxLineTotal,
} from "./shipment-display";

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
    payments: [],
    ...overrides,
  };
}

describe("shipmentLogisticsSteps", () => {
  it("marks counter delivery done and full-box receipt as next step", () => {
    const steps = shipmentLogisticsSteps(baseShipment());

    assert.equal(steps.length, 4);
    assert.equal(steps[0]?.title, "Dejar");
    assert.equal(steps[0]?.state, "done");
    assert.equal(steps[0]?.channel, "office");
    assert.equal(steps[0]?.channelLabel, "Oficina");
    assert.equal(steps[0]?.detail, "Entregado en oficina");
    assert.equal(steps[1]?.title, "Recoger");
    assert.equal(steps[1]?.state, "active");
    assert.equal(steps[1]?.channel, "office");
    assert.match(steps[1]?.detail ?? "", /oficina/i);
    assert.equal(steps[2]?.title, "Salida");
    assert.equal(steps[3]?.title, "Destino");
    assert.equal(steps.some((step) => step.kind === "transit"), false);
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

  it("recalculates pending balance from row paid instead of stale billing snapshot", () => {
    const quote = { label: "14x14x14", paid: "$200", cost: "$0", total: "$200" };
    const pending = balanceDueFromShipment(
      baseShipment({
        paid: 200,
        logistics_plan: {
          billing: {
            quotedTotal: "$200",
            payNow: "$20",
            balanceDue: "$180",
          },
        },
      }),
      quote,
    );

    assert.equal(pending, 0);
  });

  it("keeps the required deposit stable when no money was recorded", () => {
    const pendingDeposit = depositFromShipment(
      baseShipment({
        paid: 0,
        logistics_plan: {
          billing: {
            quotedTotal: "$100",
            minimumDeposit: "$20",
            depositRequired: "$25",
            depositStatus: "pending",
            payNow: "$0",
            balanceDue: "$100",
          },
        },
      }),
    );

    assert.equal(pendingDeposit, 25);
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
            orderedAt: null,
            assignedAt: null,
            loadedAt: null,
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    );

    assert.equal(steps[1]?.state, "active");
    assert.equal(steps[1]?.channel, "home");
    assert.equal(steps[1]?.channelLabel, "Domicilio");
    assert.match(steps[1]?.detail ?? "", /domicilio/i);
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

  it("keeps empty box deposit shipments on the same 4-step operational path", () => {
    const steps = shipmentLogisticsSteps(
      baseShipment({
        sale_kind: "empty_box_deposit",
        recipientId: null,
        recipientSnapshot: null,
        logistics_plan: {
          emptyBox: {
            mode: "Cliente recoge caja vacia en oficina",
            handingNow: true,
          },
        },
        delivery_notes: "Caja vacia: Caja vacia entregada en mostrador",
      }),
    );

    assert.equal(steps.length, 4);
    assert.deepEqual(
      steps.map((step) => step.kind),
      ["empty_box", "full_box", "pickup", "delivered"],
    );
    assert.equal(steps[1]?.title, "Recoger");
    assert.equal(steps[1]?.state, "active");
    assert.match(steps[1]?.detail ?? "", /Orden pendiente en envíos/i);
  });

  it("shows schedule state on home delivery tasks", () => {
    const pendingTask = {
      id: "task-empty",
      shipmentId: "shipment-1",
      taskType: "deliver_empty_box" as const,
      status: "pending" as const,
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
    };
    const scheduledTask = {
      ...pendingTask,
      id: "task-empty-scheduled",
      status: "scheduled" as const,
      scheduledAt: "2026-07-10T22:00:00.000Z",
    };

    const pendingSteps = shipmentLogisticsSteps(
      baseShipment({
        status: PENDING_EMPTY_BOX_STATUS,
        empty_box_delivered_at: null,
        logistics_plan: {
          emptyBox: { mode: "Programar entrega de caja vacia" },
          fullBox: { mode: "", deferred: true },
        },
        logisticsTasks: [pendingTask],
      }),
    );

    assert.match(pendingSteps[0]?.detail ?? "", /sin fecha/i);
    assert.equal(pendingSteps[0]?.driverTaskOrdered, true);

    const scheduledSteps = shipmentLogisticsSteps(
      baseShipment({
        status: PENDING_EMPTY_BOX_STATUS,
        empty_box_delivered_at: null,
        logistics_plan: {
          emptyBox: { mode: "Programar entrega de caja vacia" },
          fullBox: { mode: "", deferred: true },
        },
        logisticsTasks: [scheduledTask],
      }),
    );

    assert.match(scheduledSteps[0]?.detail ?? "", /^Programado · /);
  });

  it("shows pending pickup definition when full box was deferred at sale", () => {
    const steps = shipmentLogisticsSteps(
      baseShipment({
        status: PENDING_FULL_BOX_STATUS,
        empty_box_delivered_at: "2026-03-08T12:30:00.000Z",
        delivery_notes:
          "Caja vacia: Caja vacia entregada en mostrador | Caja llena: Recolección pendiente",
        logistics_plan: {
          emptyBox: {
            mode: "Cliente recoge caja vacia en oficina",
            handingNow: true,
            stockDeductedAt: "2026-03-08T12:30:00.000Z",
          },
          fullBox: {
            mode: "",
            deferred: true,
          },
        },
        logisticsTasks: [],
      }),
    );

    assert.equal(steps[1]?.title, "Recoger");
    assert.equal(steps[1]?.state, "active");
    assert.equal(steps[1]?.awaitingOrder, true);
    assert.match(steps[1]?.detail ?? "", /Orden pendiente en envíos/i);
  });

  it("keeps driver delivery awaiting order until envíos creates the task", () => {
    const steps = shipmentLogisticsSteps(
      baseShipment({
        status: PENDING_EMPTY_BOX_STATUS,
        logistics_plan: {
          emptyBox: {
            mode: "Programar entrega de caja vacia",
            scheduleMode: "pending",
          },
          fullBox: {
            mode: "",
            deferred: true,
          },
        },
        logisticsTasks: [],
      }),
    );

    assert.equal(steps[0]?.state, "active");
    assert.equal(steps[0]?.awaitingOrder, true);
    assert.equal(steps[0]?.driverTaskOrdered, false);
    assert.match(steps[0]?.detail ?? "", /Orden pendiente en envíos/i);
  });

  it("resolves initial status for deferred pickup at sale time", () => {
    assert.equal(
      resolveInitialShipmentStatus({
        saleKind: "full",
        logisticsPlan: {
          emptyBox: {
            mode: "Cliente recoge caja vacia en oficina",
            handingNow: true,
          },
          fullBox: {
            mode: "",
            deferred: true,
          },
        },
        emptyBoxDeliveredAt: new Date().toISOString(),
      }),
      PENDING_FULL_BOX_STATUS,
    );
  });
});

describe("reconcileShipmentDisplayOrderIds", () => {
  it("keeps visual order when only invoice_priority changes", () => {
    const normal = baseShipment({ id: "normal", invoice_priority: false });
    const priority = baseShipment({ id: "priority", invoice_priority: true });
    const orderIds = ["normal", "priority"];

    assert.deepEqual(
      reconcileShipmentDisplayOrderIds(orderIds, [
        { ...priority, invoice_priority: false },
        { ...normal, invoice_priority: true },
      ]),
      orderIds,
    );
  });

  it("inserts new invoices by arrival without moving existing rows", () => {
    const existing = baseShipment({
      id: "existing",
      created_at: "2026-03-01T12:00:00.000Z",
    });
    const newcomer = baseShipment({
      id: "new",
      created_at: "2026-03-10T12:00:00.000Z",
    });

    assert.deepEqual(
      reconcileShipmentDisplayOrderIds(["existing"], [existing, newcomer]),
      ["new", "existing"],
    );
  });
});

describe("orderShipmentsByStableIds", () => {
  it("keeps visual order when only invoice_priority changes", () => {
    const normal = baseShipment({ id: "normal", invoice_priority: false });
    const priority = baseShipment({ id: "priority", invoice_priority: true });
    const orderIds = ["normal", "priority"];

    assert.deepEqual(
      orderShipmentsByStableIds(
        [
          { ...priority, invoice_priority: false },
          { ...normal, invoice_priority: true },
        ],
        orderIds,
      ).map((row) => row.id),
      orderIds,
    );
  });
});

describe("sortShipmentsByArrivalOrder", () => {
  it("orders invoices newest first by created_at", () => {
    const rows = [
      baseShipment({
        id: "old",
        created_at: "2026-03-01T12:00:00.000Z",
      }),
      baseShipment({
        id: "new",
        created_at: "2026-03-10T12:00:00.000Z",
      }),
      baseShipment({
        id: "mid",
        created_at: "2026-03-05T12:00:00.000Z",
      }),
    ];

    assert.deepEqual(sortShipmentsByArrivalOrder(rows).map((row) => row.id), [
      "new",
      "mid",
      "old",
    ]);
  });

  it("ignores invoice_priority and keeps newest first", () => {
    const rows = [
      baseShipment({
        id: "old-priority",
        created_at: "2026-03-01T12:00:00.000Z",
        invoice_priority: true,
      }),
      baseShipment({
        id: "new-normal",
        created_at: "2026-03-09T12:00:00.000Z",
        invoice_priority: false,
      }),
    ];

    assert.deepEqual(sortShipmentsByArrivalOrder(rows).map((row) => row.id), [
      "new-normal",
      "old-priority",
    ]);
  });
});

describe("sortShipmentsByInvoicePriority", () => {
  it("puts priority invoices first, then newest first", () => {
    const rows = [
      baseShipment({
        id: "old-priority",
        created_at: "2026-03-01T12:00:00.000Z",
        invoice_priority: true,
      }),
      baseShipment({
        id: "new-normal",
        created_at: "2026-03-09T12:00:00.000Z",
        invoice_priority: false,
      }),
      baseShipment({
        id: "new-priority",
        created_at: "2026-03-10T12:00:00.000Z",
        invoice_priority: true,
      }),
    ];

    assert.deepEqual(sortShipmentsByInvoicePriority(rows).map((row) => row.id), [
      "new-priority",
      "old-priority",
      "new-normal",
    ]);
  });
});

describe("resolvePendingShipmentStatus", () => {
  it("returns pending empty box when empty box delivery is active", () => {
    const status = resolvePendingShipmentStatus(
      baseShipment({
        status: PENDING_EMPTY_BOX_STATUS,
        empty_box_delivered_at: null,
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
            orderedAt: null,
            assignedAt: null,
            loadedAt: null,
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    );

    assert.equal(status, PENDING_EMPTY_BOX_STATUS);
  });

  it("returns pending full box when empty box is already done", () => {
    const status = resolvePendingShipmentStatus(baseShipment());

    assert.equal(status, PENDING_FULL_BOX_STATUS);
  });

  it("resolves initial status from logistics plan at sale time", () => {
    assert.equal(
      resolveInitialShipmentStatus({
        saleKind: "full",
        logisticsPlan: {
          emptyBox: { mode: "Cliente recoge caja vacia en oficina" },
          fullBox: { mode: "Cliente trae caja llena a oficina" },
        },
      }),
      PENDING_EMPTY_BOX_STATUS,
    );

    assert.equal(
      resolveInitialShipmentStatus({
        saleKind: "full",
        logisticsPlan: {
          emptyBox: {
            mode: "Cliente recoge caja vacia en oficina",
            handingNow: true,
          },
          fullBox: { mode: "Cliente trae caja llena a oficina" },
        },
        emptyBoxDeliveredAt: "2026-03-08T12:30:00.000Z",
      }),
      PENDING_FULL_BOX_STATUS,
    );
  });

  it("does not override transit statuses during sync", () => {
    assert.deepEqual(
      syncShipmentStatusPatch(
        baseShipment({
          status: "En oficina",
        }),
      ),
      {},
    );
  });
});

describe("shipmentOperationalStatusLabel", () => {
  it("shows recolecciones when full box collection is the active step", () => {
    const label = shipmentOperationalStatusLabel(baseShipment());

    assert.equal(label, "Recolecciones");
  });

  it("shows entregas when empty box delivery is still active", () => {
    const label = shipmentOperationalStatusLabel(
      baseShipment({
        status: PENDING_EMPTY_BOX_STATUS,
        empty_box_delivered_at: null,
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
            orderedAt: null,
            assignedAt: null,
            loadedAt: null,
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    );

    assert.equal(label, "Entregas");
  });

  it("shows en transito when shipment is waiting for final delivery", () => {
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

    assert.equal(label, "En tránsito");
  });
});

describe("envios status filter buckets", () => {
  it("exposes the four tracking buckets without pendiente labels", () => {
    assert.deepEqual(
      ENVIOS_STATUS_FILTER_OPTIONS.map((option) => option.label),
      ["Recolecciones", "Entregas", "En oficina", "En tránsito"],
    );
  });

  it("matches shipments by bucket instead of substring status text", () => {
    const row = baseShipment({ status: PENDING_FULL_BOX_STATUS });

    assert.equal(matchesEnviosStatusFilter(row, "recolecciones"), true);
    assert.equal(matchesEnviosStatusFilter(row, "entregas"), false);
  });
});

describe("envios readiness filter buckets", () => {
  it("marks home logistics shipments as listos when dejar or recoger is already ordered", () => {
    const row = baseShipment({
      logistics_plan: {
        emptyBox: {
          mode: "Programar entrega de caja vacia",
          driverTaskOrdered: true,
        },
        fullBox: {
          mode: "Programar recoleccion caja llena",
        },
      },
      logisticsTasks: [
        {
          id: "task-1",
          shipmentId: "shipment-1",
          taskType: "deliver_empty_box",
          status: "scheduled",
          assignedTo: "driver-1",
          scheduledAt: "2026-07-10T17:00:00.000Z",
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

    assert.equal(classifyEnviosReadinessBucket(row), "listos");
    assert.equal(matchesEnviosReadinessFilter(row, "listos"), true);
    assert.equal(matchesEnviosReadinessFilter(row, "pendientes"), false);
    assert.equal(matchesEnviosReadinessFilter(row, "all"), true);
  });

  it("keeps ordered home logistics shipments in listos even without route or driver", () => {
    const row = baseShipment({
      logistics_plan: {
        emptyBox: {
          mode: "Programar entrega de caja vacia",
          driverTaskOrdered: true,
        },
        fullBox: {
          mode: "Programar recoleccion caja llena",
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
          orderedAt: null,
          assignedAt: null,
          loadedAt: null,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    assert.equal(classifyEnviosReadinessBucket(row), "listos");
    assert.equal(matchesEnviosReadinessFilter(row, "listos"), true);
    assert.equal(matchesEnviosReadinessFilter(row, "pendientes"), false);
  });

  it("marks home logistics shipments as pendientes until dejar or recoger is ordered", () => {
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

    assert.equal(classifyEnviosReadinessBucket(row), "pendientes");
    assert.equal(matchesEnviosReadinessFilter(row, "pendientes"), true);
    assert.equal(matchesEnviosReadinessFilter(row, "listos"), false);
  });

  it("ignores shipments outside active home logistics legs", () => {
    const row = baseShipment({
      status: PENDING_EMPTY_BOX_STATUS,
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

    assert.equal(classifyEnviosReadinessBucket(row), null);
    assert.equal(matchesEnviosReadinessFilter(row, "listos"), false);
    assert.equal(matchesEnviosReadinessFilter(row, "pendientes"), false);
    assert.equal(matchesEnviosReadinessFilter(row, "all"), true);
  });
});

describe("envios tracking vs history", () => {
  const activeRow = baseShipment({ id: "active-1", status: "Enviado" });
  const deliveredRow = baseShipment({ id: "delivered-1", status: "Entregado" });
  const rows = [activeRow, deliveredRow];

  it("classifies completed and active shipments", () => {
    assert.equal(isCompletedShipment(deliveredRow), true);
    assert.equal(isCompletedShipment(activeRow), false);
    assert.equal(isActiveShipment(activeRow), true);
    assert.equal(isActiveShipment(deliveredRow), false);
  });

  it("excludes Entregado from tracking mode", () => {
    const tracking = filterShipmentsForEnviosMode(rows, "tracking");

    assert.equal(tracking.length, 1);
    assert.equal(tracking[0]?.id, "active-1");
  });

  it("includes only Entregado in history mode", () => {
    const history = filterShipmentsForEnviosMode(rows, "history");

    assert.equal(history.length, 1);
    assert.equal(history[0]?.id, "delivered-1");
  });
});

describe("matchesEnviosSearchQuery", () => {
  it("matches sender names, phones and customer zip text", () => {
    const row = baseShipment({
      customer_name: "Carlos Diaz",
      customerPhone: "+1 (323) 555-0199",
      customerSearchText: "Carlos Diaz 742 Maple Ave Los Angeles CA 90001",
    });

    assert.equal(matchesEnviosSearchQuery(row, "diaz"), true);
    assert.equal(matchesEnviosSearchQuery(row, "5550199"), true);
    assert.equal(matchesEnviosSearchQuery(row, "90001"), true);
  });

  it("matches recipient apellido, phone, cp and address snapshot", () => {
    const row = baseShipment({
      recipientSnapshot: {
        firstName: "Maria",
        lastName: "Ochoa",
        phone: "+52 33 2222 1111",
        street: "Calle Lago",
        city: "Guadalajara",
        state: "Jalisco",
        postalCode: "44100",
      },
    });

    assert.equal(matchesEnviosSearchQuery(row, "ochoa"), true);
    assert.equal(matchesEnviosSearchQuery(row, "3322221111"), true);
    assert.equal(matchesEnviosSearchQuery(row, "44100"), true);
    assert.equal(matchesEnviosSearchQuery(row, "lago guadalajara"), true);
  });

  it("matches logistics plan, task notes and contact follow-up text", () => {
    const row = baseShipment({
      logistics_plan: {
        notes: "Cliente pide manejar fragil",
        boxLines: [{ label: "Caja grande", quantity: 2 }],
      },
      logisticsTasks: [
        {
          id: "task-1",
          shipmentId: "shipment-1",
          taskType: "pickup_full_box",
          status: "scheduled",
          assignedTo: "driver-1",
          scheduledAt: "2026-07-10T17:00:00.000Z",
          warehouseId: null,
          notes: "Porton azul",
          stockDeductedAt: null,
          completedAt: null,
          orderedAt: null,
          assignedAt: null,
          loadedAt: null,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      contactLogs: [
        {
          id: "log-1",
          shipmentId: "shipment-1",
          channel: "call",
          channelOther: "",
          outcome: "answered",
          note: "Confirmo pickup",
          nextStep: "Llamar antes de llegar",
          followUpAt: null,
          createdBy: "seller-1",
          createdByName: "Seller",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    assert.equal(matchesEnviosSearchQuery(row, "fragil"), true);
    assert.equal(matchesEnviosSearchQuery(row, "porton azul"), true);
    assert.equal(matchesEnviosSearchQuery(row, "llamar llegar"), true);
  });
});

describe("fullBoxPickupPlanStatus", () => {
  it("distinguishes deferred pickup from marked pickup", () => {
    const deferred = baseShipment({
      status: PENDING_FULL_BOX_STATUS,
      empty_box_delivered_at: "2026-03-08T12:30:00.000Z",
      logistics_plan: {
        emptyBox: {
          mode: "Cliente recoge caja vacia en oficina",
          handingNow: true,
        },
        fullBox: {
          mode: "",
          deferred: true,
        },
      },
    });
    const marked = baseShipment({
      ...deferred,
      logistics_plan: {
        ...deferred.logistics_plan,
        fullBox: {
          mode: "Programar recoleccion caja llena",
          scheduleMode: "pending",
        },
      },
      logisticsTasks: [
        {
          id: "pickup-1",
          shipmentId: "shipment-1",
          taskType: "pickup_full_box",
          status: "pending",
          scheduledAt: null,
          assignedTo: null,
          warehouseId: null,
          notes: "",
          stockDeductedAt: null,
          completedAt: null,
          orderedAt: "2026-01-01T00:00:00.000Z",
          assignedAt: null,
          loadedAt: null,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    const deferredStep = shipmentLogisticsSteps(deferred)[1];
    const markedStep = shipmentLogisticsSteps(marked)[1];

    assert.equal(fullBoxPickupPlanStatus(deferred, deferredStep), "deferred");
    assert.equal(fullBoxPickupPlanStatus(marked, markedStep), "marked");
    assert.equal(fullBoxPickupPlanStatusLabel("deferred"), "Sin marcar");
    assert.equal(fullBoxPickupPlanStatusLabel("marked"), "Marcada para recoger");
  });
});

describe("shipmentOperationalDetailLabel", () => {
  it("hides details that only repeat pending delivery or pickup", () => {
    assert.equal(
      shipmentOperationalDetailLabel({
        id: "empty",
        title: "Dejar",
        detail: "Pendiente entrega a domicilio · sin fecha",
        state: "active",
        kind: "empty_box",
        channel: "home",
        channelLabel: "Domicilio",
      }),
      "",
    );

    assert.equal(
      shipmentOperationalDetailLabel({
        id: "full",
        title: "Recoger",
        detail: "Pendiente recolección a domicilio · sin fecha",
        state: "active",
        kind: "full_box",
        channel: "home",
        channelLabel: "Domicilio",
      }),
      "",
    );
  });

  it("keeps useful details like schedule or driver", () => {
    assert.equal(
      shipmentOperationalDetailLabel({
        id: "empty",
        title: "Dejar",
        detail: "Programado · 10 de julio de 2026 a las 5:00 PM",
        state: "active",
        kind: "empty_box",
        channel: "home",
        channelLabel: "Domicilio",
      }),
      "Programado · 10 de julio de 2026 a las 5:00 PM",
    );

    assert.equal(
      shipmentOperationalDetailLabel({
        id: "full",
        title: "Recoger",
        detail: "Chofer asignado",
        state: "active",
        kind: "full_box",
        channel: "home",
        channelLabel: "Domicilio",
      }),
      "",
    );
  });
});

describe("shipmentOperationalDriverLabel", () => {
  it("shows the driver name when the active task is assigned", () => {
    const row = baseShipment({
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
          status: "assigned",
          assignedTo: "driver-1",
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
    const step = shipmentLogisticsSteps(row).find((item) => item.state === "active");

    assert.equal(
      shipmentOperationalDriverLabel(row, step, (driverId) =>
        driverId === "driver-1" ? "Carlos Lopez" : undefined,
      ),
      "Chofer: Carlos Lopez",
    );
  });

  it("shows when a home delivery has no assigned driver", () => {
    const row = baseShipment({
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
          status: "scheduled",
          assignedTo: null,
          scheduledAt: "2026-07-10T17:00:00.000Z",
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
    const step = shipmentLogisticsSteps(row).find((item) => item.state === "active");

    assert.equal(shipmentOperationalDriverLabel(row, step), "Sin chofer asignado");
  });
});

describe("shipmentOperationalAssignmentLabel", () => {
  it("does not show assignment for office steps", () => {
    const row = baseShipment({
      status: PENDING_EMPTY_BOX_STATUS,
      empty_box_delivered_at: null,
      logistics_plan: {
        emptyBox: {
          mode: "Cliente recoge caja vacia en oficina",
        },
      },
      delivery_notes: "",
      logisticsTasks: [],
    });
    const step = shipmentLogisticsSteps(row).find((item) => item.state === "active");

    assert.equal(shipmentOperationalAssignmentLabel(row, step), "");
  });

  it("shows route and driver assignment", () => {
    const row = baseShipment({
      status: PENDING_EMPTY_BOX_STATUS,
      empty_box_delivered_at: null,
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
          status: "scheduled",
          assignedTo: "driver-1",
          scheduledAt: "2026-07-10T17:00:00.000Z",
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
    const step = shipmentLogisticsSteps(row).find((item) => item.state === "active");

    const label = shipmentOperationalAssignmentLabel(
      row,
      step,
      (driverId) => (driverId === "driver-1" ? "Carlos Lopez" : undefined),
      (taskId) =>
        taskId === "task-1"
          ? {
              routeName: "Ruta Centro",
              assignedTo: "driver-1",
            }
          : undefined,
    );

    assert.equal(label, "Ruta asignada: Ruta Centro · Conductor asignado: Carlos Lopez");
  });

  it("shows unassigned route and driver", () => {
    const row = baseShipment({
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
          orderedAt: null,
          assignedAt: null,
          loadedAt: null,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    const step = shipmentLogisticsSteps(row).find((item) => item.state === "active");

    assert.equal(
      shipmentOperationalAssignmentLabel(row, step),
      "Ruta no asignada · Conductor no asignado",
    );
  });

  it("shows unassigned route and driver for neutral pending delivery", () => {
    const row = baseShipment({
      status: PENDING_EMPTY_BOX_STATUS,
      empty_box_delivered_at: null,
      logistics_plan: {},
      delivery_notes: "",
      logisticsTasks: [],
    });
    const step = shipmentLogisticsSteps(row).find((item) => item.state === "active");

    assert.equal(shipmentOperationalAssignmentLabel(row, step), "");
    assert.equal(shipmentOperationalAssignment(row, step), null);
  });
});

describe("shipmentOperationalAssignment", () => {
  it("marks ready when route and driver are assigned", () => {
    const row = baseShipment({
      status: PENDING_EMPTY_BOX_STATUS,
      empty_box_delivered_at: null,
      logistics_plan: {
        emptyBox: {
          mode: "Programar entrega de caja vacia",
        },
      },
      logisticsTasks: [
        {
          id: "task-1",
          shipmentId: "shipment-1",
          taskType: "deliver_empty_box",
          status: "scheduled",
          assignedTo: "driver-1",
          scheduledAt: "2026-07-10T17:00:00.000Z",
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
    const step = shipmentLogisticsSteps(row).find((item) => item.state === "active");
    const assignment = shipmentOperationalAssignment(
      row,
      step,
      (driverId) => (driverId === "driver-1" ? "Carlos Lopez" : undefined),
      (taskId) =>
        taskId === "task-1"
          ? {
              routeName: "Ruta Centro",
              assignedTo: "driver-1",
            }
          : undefined,
    );

    assert.deepEqual(assignment, {
      routeLabel: "Ruta Centro",
      routeAssigned: true,
      driverLabel: "Carlos Lopez",
      driverAssigned: true,
      isReady: true,
    });
  });

  it("is not ready when route or driver is missing", () => {
    const row = baseShipment({
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
          orderedAt: null,
          assignedAt: null,
          loadedAt: null,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    const step = shipmentLogisticsSteps(row).find((item) => item.state === "active");
    const assignment = shipmentOperationalAssignment(row, step);

    assert.equal(assignment?.isReady, false);
    assert.equal(assignment?.routeAssigned, false);
    assert.equal(assignment?.driverAssigned, false);
  });
});

describe("shipmentLogisticsBridgeLabel", () => {
  const pendingAssignment = {
    routeLabel: "Ruta no asignada",
    routeAssigned: false,
    driverLabel: "Conductor no asignado",
    driverAssigned: false,
    isReady: false,
  };

  const orderedStep = {
    id: "empty",
    title: "Dejar",
    detail: "Pendiente entrega a domicilio",
    kind: "empty_box" as const,
    channel: "home" as const,
    state: "active" as const,
    driverTaskOrdered: true,
  };

  it("returns empty when assignment is missing or ready", () => {
    assert.equal(shipmentLogisticsBridgeLabel(null, orderedStep), "");
    assert.equal(
      shipmentLogisticsBridgeLabel(
        {
          routeLabel: "Ruta Centro",
          routeAssigned: true,
          driverLabel: "Carlos Lopez",
          driverAssigned: true,
          isReady: true,
        },
        orderedStep,
      ),
      "",
    );
  });

  it("returns empty before the leg is marked ready for logistics", () => {
    assert.equal(
      shipmentLogisticsBridgeLabel(pendingAssignment, {
        ...orderedStep,
        awaitingOrder: true,
        driverTaskOrdered: false,
      }),
      "",
    );
    assert.equal(
      shipmentLogisticsBridgeLabel(pendingAssignment, {
        ...orderedStep,
        driverTaskOrdered: false,
      }),
      "",
    );
    assert.equal(shipmentLogisticsBridgeLabel(pendingAssignment, undefined), "");
  });

  it("returns bridge copy after logistics was notified and route or driver is pending", () => {
    assert.equal(
      shipmentLogisticsBridgeLabel(pendingAssignment, orderedStep),
      SHIPMENT_LOGISTICS_BRIDGE_LABEL,
    );
    assert.match(SHIPMENT_LOGISTICS_BRIDGE_LABEL, /Avisado a logística/);
    assert.match(SHIPMENT_LOGISTICS_BRIDGE_LABEL, /pendiente ruta y conductor/);
  });
});

describe("shipmentOperationalAssignment visibility", () => {
  it("hides assignment until the active driver leg is marked ready", () => {
    const row = baseShipment({
      status: PENDING_EMPTY_BOX_STATUS,
      empty_box_delivered_at: null,
      logistics_plan: {
        emptyBox: {
          mode: "Programar entrega de caja vacia",
          scheduleMode: "pending",
        },
        fullBox: {
          mode: "",
          deferred: true,
        },
      },
      logisticsTasks: [],
    });
    const step = shipmentLogisticsSteps(row).find((item) => item.state === "active");

    assert.equal(step?.awaitingOrder, true);
    assert.equal(step?.driverTaskOrdered, false);
    assert.equal(shipmentOperationalAssignment(row, step), null);
    assert.equal(shipmentLogisticsBridgeLabel(null, step), "");
  });
});

describe("formatBoxQuantityLabel", () => {
  it("shows quantity before the box size", () => {
    assert.equal(formatBoxQuantityLabel("14x14x14", 1), "(1) 14x14x14");
    assert.equal(formatBoxQuantityLabel("12x12x12", 3), "(3) 12x12x12");
  });
});

describe("shipment box lines", () => {
  it("reads box lines from logistics plan", () => {
    const lines = readShipmentBoxLines(
      baseShipment({
        logistics_plan: {
          boxLines: [
            { label: "14x14x14", paid: "$35", cost: "$22", quantity: 1 },
            { label: "16x16x16", paid: "$50", cost: "$31", quantity: 1 },
          ],
        },
      }),
    );

    assert.equal(lines.length, 2);
    assert.equal(shipmentBoxLinesTriggerLabel(lines), "Cajas");
    assert.equal(
      shipmentBoxLinesDetailLabel(lines),
      "(1) 14x14x14 + (1) 16x16x16",
    );
    assert.equal(shipmentBoxLineTotal(lines[0]), "$35");
  });

  it("keeps single-box trigger label compact", () => {
    const lines = readShipmentBoxLines(
      baseShipment({
        logistics_plan: {
          box: { label: "14x14x14", paid: "$35", cost: "$22" },
          boxCount: 1,
        },
      }),
    );

    assert.equal(shipmentBoxLinesTriggerLabel(lines), "(1) 14x14x14");
  });
});

describe("quoteFromShipment", () => {
  it("formats single and multi-box quotes with quantity prefix", () => {
    assert.deepEqual(
      quoteFromShipment(
        baseShipment({
          logistics_plan: {
            box: { label: "14x14x14", paid: "$200", cost: "$0" },
            boxCount: 1,
          },
        }),
      ),
      {
        label: "(1) 14x14x14",
        paid: "$200",
        cost: "$0",
        total: "$200",
      },
    );

    assert.deepEqual(
      quoteFromShipment(
        baseShipment({
          logistics_plan: {
            boxLines: [
              { label: "14x14x14", paid: "$100", cost: "$0", quantity: 2 },
              { label: "12x12x12", paid: "$80", cost: "$0", quantity: 1 },
            ],
          },
        }),
      )?.label,
      "(2) 14x14x14 + (1) 12x12x12",
    );
  });
});
