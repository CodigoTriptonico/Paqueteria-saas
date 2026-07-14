"use client";

import { ClipboardList, History } from "lucide-react";
import { useState } from "react";
import {
  InventoryAssignmentsDrawer,
} from "@/components/inventory-assignments-panel";
import {
  InventoryMovementsDrawer,
} from "@/components/inventory-movements-panel";
import {
  inventoryToolbarGroupClass,
  InventoryToolbarIconButton,
} from "@/components/inventory/inventory-toolbar-icon-button";
import type { CloseAssignmentSubmit } from "@/components/inventory-assignment-modals";
import type { InventoryAssignment, InventoryMovement } from "@/lib/inventory-types";

export function InventoryControlMenu({
  warehouseId,
  warehouseName,
  assignments,
  movements,
  initialItemId = null,
  onAssignmentsChange,
  onMovementsChange,
  onCloseAssignment,
  closingAssignmentId = "",
  bare = false,
}: {
  warehouseId: string;
  warehouseName?: string;
  assignments: InventoryAssignment[];
  movements: InventoryMovement[];
  initialItemId?: string | null;
  onAssignmentsChange: (next: InventoryAssignment[]) => void;
  onMovementsChange: (next: InventoryMovement[]) => void;
  onCloseAssignment: (assignmentId: string, input: CloseAssignmentSubmit) => Promise<boolean>;
  closingAssignmentId?: string;
  bare?: boolean;
}) {
  const [assignmentsOpen, setAssignmentsOpen] = useState(false);
  const [movementsOpen, setMovementsOpen] = useState(false);

  const triggerButtons = (
    <>
      <InventoryToolbarIconButton
        icon={ClipboardList}
        label="Asignaciones activas"
        badge={assignments.length || undefined}
        tone={assignmentsOpen ? "active" : "default"}
        onClick={() => setAssignmentsOpen(true)}
        ariaExpanded={assignmentsOpen}
        ariaHaspopup="dialog"
      />
      <InventoryToolbarIconButton
        icon={History}
        label="Historial de movimientos"
        badge={movements.length || undefined}
        tone={movementsOpen ? "active" : "default"}
        onClick={() => setMovementsOpen(true)}
        ariaExpanded={movementsOpen}
        ariaHaspopup="dialog"
      />
    </>
  );

  return (
    <>
      {bare ? triggerButtons : <div className={inventoryToolbarGroupClass}>{triggerButtons}</div>}

      <InventoryAssignmentsDrawer
        warehouseId={warehouseId}
        assignments={assignments}
        initialItemId={initialItemId}
        onAssignmentsChange={onAssignmentsChange}
        onCloseAssignment={onCloseAssignment}
        closingAssignmentId={closingAssignmentId}
        controlledOpen={assignmentsOpen}
        onControlledOpenChange={setAssignmentsOpen}
        hideTrigger
      />
      <InventoryMovementsDrawer
        warehouseId={warehouseId}
        warehouseName={warehouseName}
        movements={movements}
        assignments={assignments}
        onMovementsChange={onMovementsChange}
        controlledOpen={movementsOpen}
        onControlledOpenChange={setMovementsOpen}
        hideTrigger
      />
    </>
  );
}
