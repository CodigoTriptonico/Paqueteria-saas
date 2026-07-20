"use client";

import { LocateFixed } from "lucide-react";
import { useEffect, useState } from "react";
import {
  InventoryTrackingDrawer,
  type InventoryTrackingTab,
} from "@/components/inventory/inventory-tracking-drawer";
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
  const [open, setOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<InventoryTrackingTab>("custody");

  useEffect(() => {
    if (initialItemId) {
      queueMicrotask(() => {
        setInitialTab("assignments");
        setOpen(true);
      });
    }
  }, [initialItemId]);

  function openTracking(tab: InventoryTrackingTab = "custody") {
    setInitialTab(tab);
    setOpen(true);
  }

  const badge =
    (assignments.length || 0) + (movements.length || 0) || undefined;

  const menuItemClass =
    "flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs font-black text-slate-300 transition hover:bg-surface-card-hover hover:text-[#f8fafc]";

  const trigger =
    variant === "menu" ? (
      <button
        type="button"
        onClick={() => openTracking("custody")}
        data-inventory-toolbar-menu-action
        className={menuItemClass}
      >
        <LocateFixed className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <span className="min-w-0 flex-1">Seguimiento</span>
        {badge ? (
          <span className="rounded bg-surface-inset px-1.5 py-0.5 text-[10px] tabular-nums text-slate-400">
            {badge}
          </span>
        ) : null}
      </button>
    ) : (
      <InventoryToolbarIconButton
        icon={LocateFixed}
        label="Seguimiento"
        badge={badge}
        tone={open ? "active" : "default"}
        onClick={() => openTracking("custody")}
        ariaExpanded={open}
        ariaHaspopup="dialog"
      />
    );

  return (
    <>
      {bare || variant === "menu" ? (
        trigger
      ) : (
        <div className={inventoryToolbarGroupClass}>{trigger}</div>
      )}

      <InventoryTrackingDrawer
        warehouseId={warehouseId}
        warehouseName={warehouseName}
        assignments={assignments}
        movements={movements}
        initialItemId={initialItemId}
        initialTab={initialTab}
        onAssignmentsChange={onAssignmentsChange}
        onMovementsChange={onMovementsChange}
        onCloseAssignment={onCloseAssignment}
        closingAssignmentId={closingAssignmentId}
        controlledOpen={open}
        onControlledOpenChange={setOpen}
      />
    </>
  );
}
