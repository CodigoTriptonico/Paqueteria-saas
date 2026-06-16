import type {
  InventoryAssignment,
  InventoryAssignmentOutcome,
  InventoryMovement,
  InventoryMovementSummary,
} from "@/lib/inventory-types";

export function summarizeMovements(
  movements: InventoryMovement[],
  openAssignments: InventoryAssignment[],
): InventoryMovementSummary[] {
  const map = new Map<string, InventoryMovementSummary>();

  function key(assigneeId: string, itemId: string) {
    return `${assigneeId}|${itemId}`;
  }

  function ensure(
    assigneeId: string,
    assigneeName: string,
    itemId: string,
    itemName: string,
  ) {
    const entryKey = key(assigneeId, itemId);
    let row = map.get(entryKey);

    if (!row) {
      row = {
        assigneeId,
        assigneeName,
        itemId,
        itemName,
        openAssigned: 0,
        consumed: 0,
        damaged: 0,
        lost: 0,
        returned: 0,
      };
      map.set(entryKey, row);
    }

    return row;
  }

  for (const assignment of openAssignments) {
    const row = ensure(
      assignment.assigneeId,
      assignment.assigneeName,
      assignment.itemId,
      assignment.itemName,
    );
    row.openAssigned += assignment.qtyAssigned;
  }

  for (const movement of movements) {
    if (!movement.assigneeId) {
      continue;
    }

    const row = ensure(
      movement.assigneeId,
      movement.assigneeName || movement.assigneeId,
      movement.itemId,
      movement.itemName,
    );

    if (movement.type === "consumo") {
      row.consumed += movement.qty;
    } else if (movement.type === "dano") {
      row.damaged += movement.qty;
    } else if (movement.type === "perdida") {
      row.lost += movement.qty;
    } else if (movement.type === "devolucion") {
      row.returned += movement.qty;
    }
  }

  return [...map.values()].sort((left, right) =>
    left.assigneeName.localeCompare(right.assigneeName, "es"),
  );
}

export const assignmentOutcomeLabels: Record<InventoryAssignmentOutcome, string> = {
  returned_intact: "Devuelto intacto",
  consumed: "Consumido",
  damaged: "Dañado",
  lost: "Perdido",
  partial: "Parcial",
};
