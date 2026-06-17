"use client";

import { History, Loader2 } from "lucide-react";
import { createPortal } from "react-dom";
import { InventoryMovementsSidePanel } from "@/components/inventory-movements-panel";
import { inputClass } from "@/components/ui-blocks";
import type { InventoryAssignment, InventoryMovement } from "@/lib/inventory-types";
import type { ItemContextMenu, MovementDraft } from "@/lib/inventory-structure-utils";

export type InventoryItemContextMenuProps = {
  itemContextMenu: ItemContextMenu | null;
  setItemContextMenu: (value: ItemContextMenu | null) => void;
  movementDraft: MovementDraft | null;
  setMovementDraft: React.Dispatch<React.SetStateAction<MovementDraft | null>>;
  stockError: string;
  stockSaving: boolean;
  warehouseId?: string;
  warehouseName?: string;
  structureEditingEnabled: boolean;
  contextMenuAssignments: InventoryAssignment[];
  itemHistoryContext: ItemContextMenu | null;
  setItemHistoryContext: (value: ItemContextMenu | null) => void;
  itemHistoryMovements: InventoryMovement[];
  structureMenuMounted: boolean;
  assignments: InventoryAssignment[];
  onManageProductCountries?: (context: ItemContextMenu) => void;
  onAssignItem?: (context: ItemContextMenu) => void;
  onViewItemAssignments?: (itemId: string) => void;
  onBeginMovement: (type: MovementDraft["type"]) => void;
  onOpenItemHistory: () => void;
  onSubmitMovement: () => void | Promise<void>;
  onDeleteItem: (categoryName: string, itemId: string) => void;
  onBeginEditItem: (itemId: string, itemName: string) => void;
};

export function InventoryItemContextMenu({
  itemContextMenu,
  setItemContextMenu,
  movementDraft,
  setMovementDraft,
  stockError,
  stockSaving,
  warehouseId,
  warehouseName,
  structureEditingEnabled,
  contextMenuAssignments,
  itemHistoryContext,
  setItemHistoryContext,
  itemHistoryMovements,
  structureMenuMounted,
  assignments,
  onManageProductCountries,
  onAssignItem,
  onViewItemAssignments,
  onBeginMovement,
  onOpenItemHistory,
  onSubmitMovement,
  onDeleteItem,
  onBeginEditItem,
}: InventoryItemContextMenuProps) {
  return (
    <>
      {itemContextMenu ? (
        <div
          className="fixed z-50 w-56 rounded-lg border border-black bg-[#17211d] p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
          style={{ left: itemContextMenu.x, top: itemContextMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="border-b border-white/10 px-2 py-2">
            <p className="truncate text-sm font-black text-[#f8fafc]">
              {itemContextMenu.treeItem.name}
            </p>
            <p className="text-xs font-bold text-slate-400">
              Bodega {itemContextMenu.stockItem.stock}
              {itemContextMenu.stockItem.assigned
                ? ` · Asignado ${itemContextMenu.stockItem.assigned}`
                : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onBeginMovement("entrada")}
            className="mt-1 flex h-9 w-full items-center rounded-md px-2 text-left text-sm font-black text-emerald-200 hover:bg-emerald-400/10"
          >
            Entrada
          </button>
          <button
            type="button"
            onClick={() => onBeginMovement("salida")}
            className="flex h-9 w-full items-center rounded-md px-2 text-left text-sm font-black text-slate-200 hover:bg-surface-card-hover"
          >
            Salida
          </button>
          <button
            type="button"
            onClick={() => onBeginMovement("ajuste")}
            className="flex h-9 w-full items-center rounded-md px-2 text-left text-sm font-black text-slate-200 hover:bg-surface-card-hover"
          >
            Ajuste
          </button>
          {warehouseId ? (
            <button
              type="button"
              onClick={onOpenItemHistory}
              className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm font-black text-slate-200 hover:bg-surface-card-hover"
            >
              <History className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              Historial
            </button>
          ) : null}
          {warehouseId && onManageProductCountries ? (
            <button
              type="button"
              onClick={() => {
                if (itemContextMenu) {
                  onManageProductCountries(itemContextMenu);
                  setItemContextMenu(null);
                }
              }}
              className="flex h-9 w-full items-center rounded-md px-2 text-left text-sm font-black text-emerald-200 hover:bg-emerald-400/10"
            >
              Países y precio
            </button>
          ) : null}
          {warehouseId && onAssignItem ? (
            <button
              type="button"
              onClick={() => {
                if (itemContextMenu) {
                  onAssignItem(itemContextMenu);
                  setItemContextMenu(null);
                }
              }}
              disabled={itemContextMenu.stockItem.stock <= 0}
              className="flex h-9 w-full items-center rounded-md px-2 text-left text-sm font-black text-sky-200 hover:bg-sky-400/10 disabled:opacity-40"
            >
              Asignar a empleado
            </button>
          ) : null}
          {warehouseId && onViewItemAssignments && contextMenuAssignments.length ? (
            <button
              type="button"
              onClick={() => {
                const itemId = itemContextMenu.stockItem.id;
                onViewItemAssignments(
                  itemId.startsWith("virtual-") || itemId.startsWith("inv-")
                    ? contextMenuAssignments[0]?.itemId || itemId
                    : itemId,
                );
                setItemContextMenu(null);
              }}
              className="flex h-9 w-full items-center rounded-md px-2 text-left text-sm font-black text-slate-200 hover:bg-surface-card-hover"
            >
              Asignaciones activas ({contextMenuAssignments.length})
            </button>
          ) : null}
          <div className="my-1 border-t border-white/10" />
          {structureEditingEnabled ? (
            <>
              <button
                type="button"
                onClick={() => {
                  onBeginEditItem(
                    itemContextMenu.treeItem.id,
                    itemContextMenu.treeItem.name,
                  );
                  setItemContextMenu(null);
                }}
                className="flex h-9 w-full items-center rounded-md px-2 text-left text-sm font-black text-slate-200 hover:bg-surface-card-hover"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteItem(
                    itemContextMenu.categoryName,
                    itemContextMenu.treeItem.id,
                  );
                  setItemContextMenu(null);
                }}
                className="flex h-9 w-full items-center rounded-md px-2 text-left text-sm font-black text-rose-200 hover:bg-rose-500/10"
              >
                Borrar
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {movementDraft ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setMovementDraft(null);
            }
          }}
        >
          <form
            className="w-full max-w-sm rounded-xl border border-black bg-[#17211d] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
            onSubmit={(event) => {
              event.preventDefault();
              void onSubmitMovement();
            }}
          >
            <div className="mb-3">
              <p className="text-lg font-black capitalize text-[#f8fafc]">
                {movementDraft.type}
              </p>
              <p className="truncate text-sm font-bold text-slate-400">
                {movementDraft.context.treeItem.name}
              </p>
            </div>
            <label className="grid gap-1.5 text-xs font-black uppercase text-slate-400">
              Cantidad
              <input
                className={`${inputClass} h-10 text-sm`}
                type="number"
                min={movementDraft.type === "ajuste" ? 0 : 1}
                step="1"
                value={movementDraft.qty}
                onChange={(event) =>
                  setMovementDraft((current) =>
                    current ? { ...current, qty: event.target.value } : current,
                  )
                }
                autoFocus
              />
            </label>
            <label className="mt-3 grid gap-1.5 text-xs font-black uppercase text-slate-400">
              Nota
              <input
                className={`${inputClass} h-10 text-sm`}
                value={movementDraft.note}
                onChange={(event) =>
                  setMovementDraft((current) =>
                    current ? { ...current, note: event.target.value } : current,
                  )
                }
                placeholder="Opcional"
              />
            </label>
            {stockError ? (
              <p className="mt-3 rounded-lg border border-rose-800 bg-rose-950/30 px-3 py-2 text-sm font-bold text-rose-100">
                {stockError}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMovementDraft(null)}
                className="h-10 rounded-lg border border-black bg-surface-inset px-3 text-sm font-black text-slate-300 hover:bg-surface-card-hover"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={stockSaving}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-400 px-4 text-sm font-black text-slate-950 disabled:opacity-60"
              >
                {stockSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Guardar
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {structureMenuMounted && itemHistoryContext
        ? createPortal(
            <InventoryMovementsSidePanel
              open
              onClose={() => setItemHistoryContext(null)}
              warehouseId={warehouseId || ""}
              movements={itemHistoryMovements}
              assignments={assignments}
              warehouseName={warehouseName}
              title="Últimos movimientos"
              subtitle={itemHistoryContext.treeItem.name}
              emptyHint={`Aún no hay movimientos para ${itemHistoryContext.treeItem.name}.`}
              titleId="inventory-item-movements-title"
              zIndexClass="z-[140]"
              fixedItemId={
                itemHistoryContext.stockItem.id.startsWith("virtual-") ||
                itemHistoryContext.stockItem.id.startsWith("inv-")
                  ? undefined
                  : itemHistoryContext.stockItem.id
              }
            />,
            document.body,
          )
        : null}
    </>
  );
}
