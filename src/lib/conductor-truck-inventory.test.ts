import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildConductorFullBoxCargo,
  buildConductorTruckBalance,
  buildConductorTruckInventory,
  buildConductorTruckInventoryScope,
  buildExtraBoxesOnTruck,
  buildRouteBoxesOnTruck,
  buildRouteDeliveryBoard,
  canConductorTruckLineLoad,
  conductorTruckLoadTasks,
  conductorTruckLineKey,
  getConductorTruckLoadBlockReason,
  hasDeliverEventForTaskLine,
  isConductorTruckEventInScope,
  isConductorTruckVehicleChangeReason,
  readConductorTruckBoxLinesFromPlan,
  splitTruckLineOnTruckQty,
  sumOnTruckLines,
  validateConductorTaskResultInput,
  validateConductorTruckReturnInput,
  validateConductorTruckDeliver,
  validateConductorTruckLoad,
  type ConductorTruckBoxLine,
  type ConductorTruckEventType,
  type ConductorTruckInventoryEvent,
  type ConductorTruckStockItem,
  type ConductorTruckTaskInput,
} from "@/lib/conductor-truck-inventory";

function box(label: string, quantity: number, catalogKey = ""): ConductorTruckBoxLine {
  return {
    key: conductorTruckLineKey({ label, catalogKey }),
    catalogKey,
    label,
    quantity,
  };
}

function task(partial: Partial<ConductorTruckTaskInput> = {}): ConductorTruckTaskInput {
  return {
    id: partial.id || "task-1",
    shipmentId: partial.shipmentId || "ship-1",
    routeId: partial.routeId ?? "route-1",
    routeName: partial.routeName ?? "Ruta norte",
    routeDate: partial.routeDate ?? "2026-07-06",
    taskType: partial.taskType || "deliver_empty_box",
    status: partial.status || "assigned",
    warehouseId: partial.warehouseId ?? "wh-1",
    boxLines: partial.boxLines || [box("Caja chica", 10)],
  };
}

function stock(partial: Partial<ConductorTruckStockItem> = {}): ConductorTruckStockItem {
  return {
    itemId: partial.itemId || "item-small",
    itemName: partial.itemName || "Caja chica",
    category: partial.category || "",
    kind: partial.kind || "Caja chica",
    subcategory: partial.subcategory,
    warehouseId: partial.warehouseId || "wh-1",
    stock: partial.stock ?? 100,
  };
}

function event(
  eventType: ConductorTruckEventType,
  qty: number,
  partial: Partial<ConductorTruckInventoryEvent> = {},
): ConductorTruckInventoryEvent {
  return {
    eventType,
    routeId: partial.routeId !== undefined ? partial.routeId : "route-1",
    taskId: partial.taskId !== undefined ? partial.taskId : null,
    shipmentId: partial.shipmentId ?? null,
    warehouseId: partial.warehouseId ?? "wh-1",
    itemId: partial.itemId ?? "item-small",
    itemName: partial.itemName || "Caja chica",
    catalogKey: partial.catalogKey || "",
    itemLabel: partial.itemLabel || "Caja chica",
    qty,
    createdAt: partial.createdAt,
  };
}

describe("readConductorTruckBoxLinesFromPlan", () => {
  it("reads required boxes by size from logistics plan", () => {
    const lines = readConductorTruckBoxLinesFromPlan({
      boxLines: [
        { catalogKey: "small", label: "Caja chica", quantity: 6 },
        { catalogKey: "large", label: "Caja grande", quantity: "4" },
      ],
    });

    assert.deepEqual(
      lines.map((line) => ({ catalogKey: line.catalogKey, label: line.label, quantity: line.quantity })),
      [
        { catalogKey: "small", label: "Caja chica", quantity: 6 },
        { catalogKey: "large", label: "Caja grande", quantity: 4 },
      ],
    );
  });
});

describe("buildConductorTruckInventory", () => {
  it("blocks route when required 10 and loaded 8", () => {
    const summary = buildConductorTruckInventory({
      tasks: [task()],
      events: [event("load", 8)],
      stock: [stock()],
    });

    assert.equal(summary.requiredTotal, 10);
    assert.equal(summary.currentTotal, 8);
    assert.equal(summary.shortageTotal, 2);
    assert.equal(summary.ready, false);
  });

  it("groups required boxes by size", () => {
    const small = box("Caja chica", 6);
    const large = box("Caja grande", 2);
    const summary = buildConductorTruckInventory({
      tasks: [
        task({ id: "task-1", boxLines: [small] }),
        task({ id: "task-2", boxLines: [box("Caja chica", 4)] }),
        task({ id: "task-3", boxLines: [large] }),
      ],
      events: [],
      stock: [
        stock({ itemName: "Caja chica", kind: "Caja chica", stock: 20 }),
        stock({ itemId: "item-large", itemName: "Caja grande", kind: "Caja grande", stock: 5 }),
      ],
    });

    const smallLine = summary.lines.find((line) => line.label === "Caja chica");
    const largeLine = summary.lines.find((line) => line.label === "Caja grande");

    assert.equal(smallLine?.requiredQty, 10);
    assert.equal(largeLine?.requiredQty, 2);
  });

  it("uses stock from the task warehouse first", () => {
    const summary = buildConductorTruckInventory({
      tasks: [task({ warehouseId: "wh-route" })],
      events: [],
      stock: [
        stock({ itemId: "wrong", warehouseId: "wh-other", stock: 99 }),
        stock({ itemId: "right", warehouseId: "wh-route", stock: 7 }),
      ],
    });
    const line = summary.lines[0]!;

    assert.equal(line.itemId, "right");
    assert.equal(line.warehouseId, "wh-route");
    assert.equal(line.stockQty, 7);
  });

  it("does not count pickup tasks as route blockers", () => {
    const summary = buildConductorTruckInventory({
      tasks: [task({ taskType: "pickup_full_box", boxLines: [box("Caja chica", 99)] })],
      events: [],
      stock: [stock()],
    });

    assert.equal(summary.requiredTotal, 0);
    assert.equal(summary.ready, true);
  });

  it("delivery removes boxes from truck without changing warehouse stock", () => {
    const summary = buildConductorTruckInventory({
      tasks: [task()],
      events: [event("load", 10), event("deliver", 3, { taskId: "task-1" })],
      stock: [stock({ stock: 4 })],
    });
    const line = summary.lines[0]!;

    assert.equal(line.loadedQty, 10);
    assert.equal(line.deliveredQty, 3);
    assert.equal(line.currentQty, 7);
    assert.equal(summary.deliveredTotal, 3);
    assert.equal(line.stockQty, 4);
  });

  it("ignores events outside today's scope", () => {
    const tasks = [task({ id: "task-today", routeId: "route-today", routeDate: "2026-07-07" })];
    const scope = buildConductorTruckInventoryScope(tasks, "2026-07-07");
    const summary = buildConductorTruckInventory({
      tasks,
      events: [
        event("load", 10, { routeId: "route-today", createdAt: "2026-07-07T08:00:00.000Z" }),
        event("load", 5, { routeId: "route-old", createdAt: "2026-07-06T08:00:00.000Z" }),
      ],
      stock: [stock()],
      scope,
    });

    assert.equal(summary.currentTotal, 10);
    assert.equal(summary.loadedTotal, 10);
  });

  it("detects duplicate deliver events for the same task line", () => {
    const boxLine = box("Caja chica", 3);
    const events = [
      event("deliver", 3, { taskId: "task-1", itemLabel: "Caja chica" }),
    ];

    assert.equal(hasDeliverEventForTaskLine(events, "task-1", boxLine), true);
    assert.equal(hasDeliverEventForTaskLine(events, "task-2", boxLine), false);
  });

  it("scopes load and return events by created date when they have no task", () => {
    const scope = { date: "2026-07-07", routeIds: ["route-today"], taskIds: ["task-1"] };

    assert.equal(
      isConductorTruckEventInScope(
        event("load", 4, {
          routeId: "route-old",
          taskId: null,
          createdAt: "2026-07-07T09:00:00.000Z",
        }),
        scope,
      ),
      true,
    );
    assert.equal(
      isConductorTruckEventInScope(
        event("load", 4, {
          routeId: "route-old",
          taskId: null,
          createdAt: "2026-07-06T09:00:00.000Z",
        }),
        scope,
      ),
      false,
    );
  });

  it("keeps extra boxes in the truck across route dates when persistence is enabled", () => {
    const summary = buildConductorTruckInventory({
      tasks: [],
      events: [
        event("load", 5, {
          routeId: "route-old",
          createdAt: "2026-07-06T08:00:00.000Z",
        }),
        event("return", 2, {
          routeId: "route-old",
          createdAt: "2026-07-07T08:00:00.000Z",
        }),
      ],
      stock: [stock({ stock: 20 })],
      scope: { date: "2026-07-07", routeIds: [], taskIds: [] },
      includePersistentEvents: true,
    });

    assert.equal(summary.lines[0]?.requiredQty, 0);
    assert.equal(summary.lines[0]?.currentQty, 3);
    assert.equal(summary.currentTotal, 3);
  });

  it("builds a per-driver balance from extra truck events", () => {
    const balance = buildConductorTruckBalance({
      vehicleId: "vehicle-1",
      vehicleName: "Camion 1",
      vehiclePlate: "ABC-123",
      assignedDriverId: "driver-1",
      assignedDriverName: "Ana",
      events: [event("load", 4), event("deliver", 1)],
      stock: [stock()],
    });

    assert.equal(balance.vehicleId, "vehicle-1");
    assert.equal(balance.assignedDriverId, "driver-1");
    assert.equal(balance.assignedDriverName, "Ana");
    assert.equal(balance.totalQty, 3);
    assert.equal(balance.lines[0]?.currentQty, 3);
  });
});

describe("conductorTruckLoadTasks", () => {
  it("includes a direct delivery even when the driver has no route", () => {
    const directDelivery = { ...task({ id: "direct" }), routeId: null, routeName: null, routeDate: null };

    assert.deepEqual(conductorTruckLoadTasks([directDelivery], null), [directDelivery]);
  });

  it("keeps direct deliveries alongside the selected route", () => {
    const directDelivery = { ...task({ id: "direct" }), routeId: null, routeName: null, routeDate: null };
    const selectedRouteTask = task({ id: "selected", routeId: "route-1" });
    const otherRouteTask = task({ id: "other", routeId: "route-2" });
    const pickupOnRoute = task({ id: "pickup", taskType: "pickup_full_box", routeId: "route-1" });

    assert.deepEqual(
      conductorTruckLoadTasks(
        [directDelivery, selectedRouteTask, otherRouteTask, pickupOnRoute],
        "route-1",
      ).map((entry) => entry.id),
      ["direct", "selected"],
    );
  });
});

describe("conductor truck validation", () => {
  it("does not allow loading more than warehouse stock", () => {
    const summary = buildConductorTruckInventory({
      tasks: [task()],
      events: [],
      stock: [stock({ stock: 8 })],
    });

    assert.match(validateConductorTruckLoad(summary.lines[0]!, 9), /Stock insuficiente/);
  });

  it("does not allow loading more than required", () => {
    const summary = buildConductorTruckInventory({
      tasks: [task()],
      events: [],
      stock: [stock({ stock: 20 })],
    });

    assert.equal(validateConductorTruckLoad(summary.lines[0]!, 11), "No puedes cargar mas de lo requerido");
  });

  it("requires photo on success and reason on failure", () => {
    assert.equal(
      validateConductorTaskResultInput({
        result: "completed",
        taskType: "deliver_empty_box",
      }),
      "Foto requerida",
    );

    assert.equal(
      validateConductorTaskResultInput({
        result: "failed",
        taskType: "deliver_empty_box",
      }),
      "Selecciona una razon",
    );

    assert.equal(
      validateConductorTaskResultInput({
        result: "failed",
        taskType: "deliver_empty_box",
        failureReason: "Cliente no contesto",
      }),
      "",
    );

    assert.equal(
      validateConductorTaskResultInput({
        result: "completed",
        taskType: "pickup_full_box",
        evidenceFileName: "caja.jpg",
      }),
      "Confirma que el invoice se ve escrito en la caja",
    );

    assert.equal(
      validateConductorTaskResultInput({
        result: "completed",
        taskType: "pickup_full_box",
        evidenceFileName: "caja.jpg",
        invoiceVisible: true,
      }),
      "",
    );

    assert.equal(
      validateConductorTaskResultInput({
        result: "failed",
        taskType: "pickup_full_box",
        failureReason: "Invoice no visible",
      }),
      "Toma una foto de la caja sin invoice para reportarlo",
    );
  });

  it("blocks delivery when truck stock is insufficient", () => {
    const summary = buildConductorTruckInventory({
      tasks: [task()],
      events: [event("load", 2)],
      stock: [stock()],
    });

    assert.match(validateConductorTruckDeliver(summary.lines[0]!, 3), /Faltan cajas en camion/);
  });

  it("explains when inventory item is not linked", () => {
    const line = {
      key: "label:16x16x16",
      catalogKey: "",
      label: "16x16x16",
      requiredQty: 1,
      loadedQty: 0,
      deliveredQty: 0,
      returnedQty: 0,
      currentQty: 0,
      shortageQty: 1,
      stockQty: 9,
      itemId: null,
      itemName: "",
      warehouseId: null,
      taskIds: [],
      routeIds: [],
    };

    assert.match(getConductorTruckLoadBlockReason(line), /No hay item de inventario vinculado/);
    assert.equal(canConductorTruckLineLoad(line), false);
  });

  it("duplicate delivery attempt does not change truck totals", () => {
    const boxLine = box("Caja chica", 3);
    const existingEvents = [
      event("load", 10),
      event("deliver", 3, { taskId: "task-1", itemLabel: "Caja chica" }),
    ];
    const duplicateEvent = event("deliver", 3, { taskId: "task-1", itemLabel: "Caja chica" });
    const eventsToApply = hasDeliverEventForTaskLine(existingEvents, "task-1", boxLine)
      ? existingEvents
      : [...existingEvents, duplicateEvent];

    const summary = buildConductorTruckInventory({
      tasks: [task()],
      events: eventsToApply,
      stock: [stock()],
    });

    assert.equal(summary.currentTotal, 7);
    assert.equal(summary.deliveredTotal, 3);
  });
});

describe("full box cargo", () => {
  it("keeps collected boxes in the truck until warehouse unload", () => {
    const summary = buildConductorFullBoxCargo([
      event("collect_full_box", 2, {
        taskId: "pickup-1",
        shipmentId: "shipment-1",
        routeId: "route-1",
        itemLabel: "Caja grande",
      }),
      event("unload_full_box", 1, {
        taskId: "pickup-1",
        shipmentId: "shipment-1",
        routeId: "route-1",
        itemLabel: "Caja grande",
      }),
    ]);

    assert.equal(summary.collectedTotal, 2);
    assert.equal(summary.unloadedTotal, 1);
    assert.equal(summary.pendingTotal, 1);
  });
});

describe("truck on-truck split", () => {
  it("splits route and extra quantities on the same line", () => {
    assert.deepEqual(
      splitTruckLineOnTruckQty({ requiredQty: 15, deliveredQty: 0, currentQty: 17 }),
      { routeQty: 15, extraQty: 2 },
    );
    assert.deepEqual(
      splitTruckLineOnTruckQty({ requiredQty: 0, deliveredQty: 0, currentQty: 4 }),
      { routeQty: 0, extraQty: 4 },
    );
    assert.deepEqual(
      splitTruckLineOnTruckQty({ requiredQty: 15, deliveredQty: 5, currentQty: 12 }),
      { routeQty: 10, extraQty: 2 },
    );
  });

  it("builds separate route and extra lists for the truck UI", () => {
    const lines = [
      {
        key: "a",
        catalogKey: "",
        label: "14x14x14",
        requiredQty: 9,
        loadedQty: 9,
        deliveredQty: 0,
        returnedQty: 0,
        currentQty: 9,
        shortageQty: 0,
        stockQty: 0,
        itemId: "item-a",
        itemName: "14x14x14",
        warehouseId: "wh-1",
        taskIds: [],
        routeIds: [],
      },
      {
        key: "b",
        catalogKey: "",
        label: "16x16x16",
        requiredQty: 6,
        loadedQty: 8,
        deliveredQty: 0,
        returnedQty: 0,
        currentQty: 8,
        shortageQty: 0,
        stockQty: 0,
        itemId: "item-b",
        itemName: "16x16x16",
        warehouseId: "wh-1",
        taskIds: [],
        routeIds: [],
      },
    ];

    const routeLines = buildRouteBoxesOnTruck(lines);
    const extraLines = buildExtraBoxesOnTruck(lines);

    assert.equal(sumOnTruckLines(routeLines), 15);
    assert.equal(sumOnTruckLines(extraLines), 2);
    assert.equal(routeLines.find((line) => line.label === "16x16x16")?.qty, 6);
    assert.equal(extraLines.find((line) => line.label === "16x16x16")?.qty, 2);
  });

  it("builds a route delivery board with loaded and pending quantities", () => {
    const board = buildRouteDeliveryBoard([
      {
        key: "a",
        catalogKey: "",
        label: "14x14x14",
        requiredQty: 9,
        loadedQty: 0,
        deliveredQty: 0,
        returnedQty: 0,
        currentQty: 0,
        shortageQty: 9,
        stockQty: 20,
        itemId: "item-a",
        itemName: "14x14x14",
        warehouseId: "wh-1",
        taskIds: [],
        routeIds: [],
      },
      {
        key: "b",
        catalogKey: "",
        label: "16x16x16",
        requiredQty: 6,
        loadedQty: 6,
        deliveredQty: 0,
        returnedQty: 0,
        currentQty: 6,
        shortageQty: 0,
        stockQty: 10,
        itemId: "item-b",
        itemName: "16x16x16",
        warehouseId: "wh-1",
        taskIds: [],
        routeIds: [],
      },
    ]);

    assert.equal(board.length, 2);
    assert.equal(board[0]?.pendingQty, 9);
    assert.equal(board[0]?.onTruckQty, 0);
    assert.equal(board[1]?.onTruckQty, 6);
    assert.equal(board[1]?.pendingQty, 0);
  });

  it("requires a return reason for audit", () => {
    assert.equal(validateConductorTruckReturnInput({ reason: "" }), "Selecciona un motivo");
    assert.equal(validateConductorTruckReturnInput({ reason: "Sobro carga" }), "");
    assert.equal(
      validateConductorTruckReturnInput({ reason: "Cambio de vehiculo" }),
      "Selecciona el vehículo destino",
    );
    assert.equal(
      validateConductorTruckReturnInput({
        reason: "Cambio de vehiculo",
        targetVehicleId: "vehicle-2",
      }),
      "",
    );
    assert.equal(isConductorTruckVehicleChangeReason("Cambio de vehiculo"), true);
  });
});
