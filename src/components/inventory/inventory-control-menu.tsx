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
  variant = "toolbar",
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
  variant?: "toolbar" | "menu";
}) {
  const [assignmentsOpen, setAssignmentsOpen] = useState(false);
  const [movementsOpen, setMovementsOpen] = useState(false);

  const menuItemClass =
    "flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs font-black text-slate-300 transition hover:bg-surface-card-hover hover:text-[#f8fafc]";

  const triggerButtons = variant === "menu" ? (
    <>
      <button
        type="button"
        onClick={() => setAssignmentsOpen(true)}
        data-inventory-toolbar-menu-action
        className={menuItemClass}
      >
        <ClipboardList className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <span className="min-w-0 flex-1">Asignaciones activas</span>
        {assignments.length ? (
          <span className="rounded bg-surface-inset px-1.5 py-0.5 text-[10px] tabular-nums text-slate-400">
            {assignments.length}
          </span>
        ) : null}
      </button>
      <button
        type="button"
        onClick={() => setMovementsOpen(true)}
        data-inventory-toolbar-menu-action
        className={menuItemClass}
      >
        <History className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <span className="min-w-0 flex-1">Historial de movimientos</span>
      </button>
    </>
  ) : (
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
      {bare || variant === "menu" ? (
        triggerButtons
      ) : (
        <div className={inventoryToolbarGroupClass}>{triggerButtons}</div>
      )}

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
