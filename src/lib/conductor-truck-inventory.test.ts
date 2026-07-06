import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildConductorTruckInventory,
  conductorTruckLineKey,
  readConductorTruckBoxLinesFromPlan,
  validateConductorTaskResultInput,
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
    routeId: partial.routeId ?? "route-1",
    taskId: partial.taskId ?? null,
    shipmentId: partial.shipmentId ?? null,
    warehouseId: partial.warehouseId ?? "wh-1",
    itemId: partial.itemId ?? "item-small",
    itemName: partial.itemName || "Caja chica",
    catalogKey: partial.catalogKey || "",
    itemLabel: partial.itemLabel || "Caja chica",
    qty,
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
      events: [event("load", 10), event("deliver", 3)],
      stock: [stock({ stock: 4 })],
    });
    const line = summary.lines[0]!;

    assert.equal(line.loadedQty, 10);
    assert.equal(line.deliveredQty, 3);
    assert.equal(line.currentQty, 7);
    assert.equal(line.stockQty, 4);
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
  });
});
