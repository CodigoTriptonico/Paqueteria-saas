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
import type { ConductorTruckBalance } from "@/lib/conductor-truck-inventory";
import type { InventoryStockItem } from "@/lib/inventory-stock";
import type { InventoryAssignment, InventoryMovement } from "@/lib/inventory-types";

export function InventoryControlMenu({
  warehouseId,
  warehouseName,
  items,
  truckBalances,
  assignments,
  movements,
  initialItemId = null,
  onAssignmentsChange,
  onMovementsChange,
  onCloseAssignment,
  closingAssignmentId = "",
  bare = false,
  variant = "toolbar",
  showDrawer = true,
  trackingOpen,
  onTrackingOpenChange,
  trackingTab,
  onTrackingTabChange,
}: {
  warehouseId: string;
  warehouseName?: string;
  items: InventoryStockItem[];
  truckBalances: ConductorTruckBalance[];
  assignments: InventoryAssignment[];
  movements: InventoryMovement[];
  initialItemId?: string | null;
  onAssignmentsChange: (next: InventoryAssignment[]) => void;
  onMovementsChange: (next: InventoryMovement[]) => void;
  onCloseAssignment: (assignmentId: string, input: CloseAssignmentSubmit) => Promise<boolean>;
  closingAssignmentId?: string;
  bare?: boolean;
  variant?: "toolbar" | "menu";
  showDrawer?: boolean;
  trackingOpen?: boolean;
  onTrackingOpenChange?: (open: boolean) => void;
  trackingTab?: InventoryTrackingTab;
  onTrackingTabChange?: (tab: InventoryTrackingTab) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [internalTab, setInternalTab] = useState<InventoryTrackingTab>("custody");
  const open = trackingOpen ?? internalOpen;
  const setOpen = onTrackingOpenChange ?? setInternalOpen;
  const initialTab = trackingTab ?? internalTab;
  const setInitialTab = onTrackingTabChange ?? setInternalTab;

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
    "flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-black text-slate-300 transition hover:bg-surface-card-hover hover:text-[#f8fafc]";

  const trigger =
    variant === "menu" ? (
      <button
        type="button"
        onClick={() => openTracking("custody")}
        data-inventory-toolbar-menu-action
        className={menuItemClass}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-400/10 text-emerald-300">
          <LocateFixed className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block">Custodia</span>
          <span className="mt-0.5 block text-[10px] font-bold text-slate-500">
            Quién tiene cada caja y sus movimientos
          </span>
        </span>
        {badge ? (
          <span className="rounded-md bg-surface-inset px-1.5 py-0.5 text-[10px] tabular-nums text-slate-400">
            {badge}
          </span>
        ) : null}
      </button>
    ) : (
      <InventoryToolbarIconButton
        icon={LocateFixed}
        label="Custodia"
        badge={badge}
        tone={open ? "active" : "default"}
        onClick={() => openTracking("custody")}
        ariaExpanded={open}
        ariaHaspopup="dialog"
      />
    );

  const drawer = showDrawer ? (
    <InventoryTrackingDrawer
      warehouseId={warehouseId}
      warehouseName={warehouseName}
      items={items}
      truckBalances={truckBalances}
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
  ) : null;

  return (
    <>
      {bare || variant === "menu" ? (
        trigger
      ) : (
        <div className={inventoryToolbarGroupClass}>{trigger}</div>
      )}

      {drawer}
    </>
  );
}
