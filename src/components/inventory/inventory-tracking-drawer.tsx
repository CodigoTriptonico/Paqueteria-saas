"use client";

import { ArrowRightLeft, ClipboardList, History, LocateFixed, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { InventoryAssignmentsDrawer } from "@/components/inventory-assignments-panel";
import { InventoryCustodyPanel } from "@/components/inventory/inventory-custody-panel";
import { InventoryTransfersPanel } from "@/components/inventory/inventory-transfers-panel";
import { InventoryMovementsDrawer } from "@/components/inventory-movements-panel";
import { AppTabs, type AppTabDefinition } from "@/components/app-tabs";
import type { CloseAssignmentSubmit } from "@/components/inventory-assignment-modals";
import type { ConductorTruckBalance } from "@/lib/conductor-truck-inventory";
import type { InventoryStockItem } from "@/lib/inventory-stock";
import type { InventoryAssignment, InventoryMovement } from "@/lib/inventory-types";

export type InventoryTrackingTab = "custody" | "transfers" | "assignments" | "history";

const trackingTabs: AppTabDefinition<InventoryTrackingTab>[] = [
  { id: "custody", label: "Dónde están", icon: LocateFixed },
  { id: "transfers", label: "Transferencias", icon: ArrowRightLeft },
  { id: "assignments", label: "Asignaciones", icon: ClipboardList },
  { id: "history", label: "Historial", icon: History },
];

type WarehouseOption = {
  id: string;
  name: string;
};

type InventoryTrackingDrawerProps = {
  warehouseId: string;
  warehouseName?: string;
  warehouses?: WarehouseOption[];
  items: InventoryStockItem[];
  truckBalances: ConductorTruckBalance[];
  assignments: InventoryAssignment[];
  movements: InventoryMovement[];
  initialItemId?: string | null;
  initialTab?: InventoryTrackingTab;
  onAssignmentsChange: (next: InventoryAssignment[]) => void;
  onMovementsChange: (next: InventoryMovement[]) => void;
  onCloseAssignment: (assignmentId: string, input: CloseAssignmentSubmit) => Promise<boolean>;
  onInventoryRefresh?: () => Promise<void> | void;
  closingAssignmentId?: string;
  controlledOpen?: boolean;
  onControlledOpenChange?: (open: boolean) => void;
};

export function InventoryTrackingDrawer({
  warehouseId,
  warehouseName,
  items,
  truckBalances,
  assignments,
  movements,
  initialItemId = null,
  initialTab = "custody",
  warehouses = [],
  onAssignmentsChange,
  onMovementsChange,
  onCloseAssignment,
  onInventoryRefresh,
  closingAssignmentId = "",
  controlledOpen,
  onControlledOpenChange,
}: InventoryTrackingDrawerProps) {
  const [open, setOpen] = useState(false);
  const drawerOpen = controlledOpen ?? open;
  const setDrawerOpen = useCallback(
    (next: boolean) => {
      if (controlledOpen === undefined) {
        setOpen(next);
      }

      onControlledOpenChange?.(next);
    },
    [controlledOpen, onControlledOpenChange],
  );
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<InventoryTrackingTab>(initialTab);

  useEffect(() => {
    queueMicrotask(() => {
      setMounted(true);
    });
  }, []);

  useEffect(() => {
    if (!drawerOpen) {
      return;
    }

    queueMicrotask(() => {
      setTab(initialTab);
    });
  }, [drawerOpen, initialTab]);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, [setDrawerOpen]);

  useEffect(() => {
    if (!drawerOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeDrawer();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeDrawer, drawerOpen]);

  const drawer =
    drawerOpen && mounted ? (
      <div className="fixed inset-0 z-[135] flex justify-end">
        <button
          type="button"
          className="absolute inset-0 bg-black/50"
          aria-label="Cerrar custodia"
          onClick={closeDrawer}
        />
        <aside
          className="relative flex h-full w-full max-w-3xl flex-col border-l border-black bg-[#1a2320] shadow-[-20px_0_50px_rgba(0,0,0,0.45)]"
          role="dialog"
          aria-modal
          aria-labelledby="inventory-tracking-title"
        >
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-black/70 px-4 py-4">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                Inventario
              </p>
              <h2 id="inventory-tracking-title" className="text-lg font-black text-[#f8fafc]">
                Custodia
              </h2>
              <p className="mt-0.5 truncate text-sm font-bold text-slate-400">
                {warehouseName || "Bodega activa"}
              </p>
            </div>
            <button
              type="button"
              onClick={closeDrawer}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black bg-[#111827] text-slate-300 hover:text-[#f8fafc]"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </header>

          <div className="shrink-0 border-b border-black/70 px-4 py-3">
            <AppTabs
              tabs={trackingTabs.map((entry) => ({
                ...entry,
                badge:
                  entry.id === "assignments"
                    ? assignments.length || undefined
                    : entry.id === "history"
                      ? movements.length || undefined
                      : undefined,
              }))}
              value={tab}
              onChange={setTab}
              size="compact"
              ariaLabel="Vistas de custodia"
            />
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            {tab === "custody" ? (
              <InventoryCustodyPanel
                warehouseName={warehouseName}
                items={items}
                truckBalances={truckBalances}
                active={drawerOpen}
              />
            ) : tab === "transfers" ? (
              <InventoryTransfersPanel
                warehouseId={warehouseId}
                warehouseName={warehouseName}
                warehouses={warehouses}
                items={items}
                active={drawerOpen}
                onInventoryRefresh={onInventoryRefresh}
              />
            ) : tab === "assignments" ? (
              <InventoryAssignmentsDrawer
                embedded
                warehouseId={warehouseId}
                assignments={assignments}
                items={items}
                initialItemId={initialItemId}
                onAssignmentsChange={onAssignmentsChange}
                onCloseAssignment={onCloseAssignment}
                closingAssignmentId={closingAssignmentId}
                controlledOpen
                hideTrigger
              />
            ) : (
              <InventoryMovementsDrawer
                embedded
                warehouseId={warehouseId}
                movements={movements}
                assignments={assignments}
                items={items}
                warehouseName={warehouseName}
                onMovementsChange={onMovementsChange}
                controlledOpen
                hideTrigger
              />
            )}
          </div>
        </aside>
      </div>
    ) : null;

  return drawer ? createPortal(drawer, document.body) : null;
}
