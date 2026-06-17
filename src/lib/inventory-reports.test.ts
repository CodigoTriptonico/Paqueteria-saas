import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { InventoryAssignment, InventoryMovement } from "@/lib/inventory-types";
import { summarizeMovements } from "./inventory-reports";

const openAssignments: InventoryAssignment[] = [
  {
    id: "a1",
    warehouseId: "wh-1",
    itemId: "item-1",
    itemName: "12x12x12",
    assigneeId: "user-1",
    assigneeName: "Ana",
    qtyAssigned: 3,
    qtyReturned: 0,
    qtyConsumed: 0,
    qtyDamaged: 0,
    qtyLost: 0,
    status: "open",
    outcome: null,
    note: "",
    assignedAt: "2026-01-01T00:00:00.000Z",
  },
];

const movements: InventoryMovement[] = [
  {
    id: "m1",
    itemId: "item-1",
    itemName: "12x12x12",
    type: "consumo",
    qty: 1,
    note: "",
    createdAt: "2026-01-02T00:00:00.000Z",
    assigneeId: "user-1",
    assigneeName: "Ana",
  },
  {
    id: "m2",
    itemId: "item-1",
    itemName: "12x12x12",
    type: "dano",
    qty: 1,
    note: "",
    createdAt: "2026-01-03T00:00:00.000Z",
    assigneeId: "user-1",
    assigneeName: "Ana",
  },
  {
    id: "m3",
    itemId: "item-2",
    itemName: "14x14x14",
    type: "devolucion",
    qty: 2,
    note: "",
    createdAt: "2026-01-04T00:00:00.000Z",
    assigneeId: "user-2",
    assigneeName: "Bruno",
  },
  {
    id: "m4",
    itemId: "item-1",
    itemName: "12x12x12",
    type: "entrada",
    qty: 5,
    note: "",
    createdAt: "2026-01-05T00:00:00.000Z",
  },
];

describe("inventory-reports", () => {
  it("summarizes open assignments and assignee movements", () => {
    const summary = summarizeMovements(movements, openAssignments);

    assert.equal(summary.length, 2);

    const ana = summary.find((row) => row.assigneeName === "Ana");
    assert.equal(ana?.openAssigned, 3);
    assert.equal(ana?.consumed, 1);
    assert.equal(ana?.damaged, 1);
    assert.equal(ana?.lost, 0);
    assert.equal(ana?.returned, 0);

    const bruno = summary.find((row) => row.assigneeName === "Bruno");
    assert.equal(bruno?.returned, 2);
    assert.equal(bruno?.openAssigned, 0);
  });

  it("sorts summaries by assignee name in Spanish locale", () => {
    const summary = summarizeMovements(movements, openAssignments);
    assert.deepEqual(
      summary.map((row) => row.assigneeName),
      ["Ana", "Bruno"],
    );
  });
});
