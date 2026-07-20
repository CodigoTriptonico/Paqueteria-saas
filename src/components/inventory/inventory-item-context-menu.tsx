"use client";

import { History, ImagePlus, Loader2, MapPin, Ruler } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { InventoryMovementsSidePanel } from "@/components/inventory-movements-panel";
import { inputClass } from "@/components/ui-blocks";
import type { InventoryAssignment, InventoryMovement } from "@/lib/inventory-types";
import {
  manualMovementReasonOptions,
  movementReasonRequiresDetail,
} from "@/lib/inventory-movement-audit";
import { syncEntryCostFields } from "@/lib/inventory-entry-cost";
import type { ItemContextMenu, MovementDraft } from "@/lib/inventory-structure-utils";
import {
  formatInventoryStockLabel,
  INVENTORY_UNIT_PRESETS,
  normalizeInventoryUnit,
  resolveInventoryItemUnit,
} from "@/lib/inventory-units";

const INVENTORY_ITEM_CONTEXT_MENU_ATTR = "data-inventory-item-context-menu";

export type InventoryItemContextMenuProps = {
  itemContextMenu: ItemContextMenu | null;
  setItemContextMenu: (value: ItemContextMenu | null) => void;
  movementDraft: MovementDraft | null;
  setMovementDraft: React.Dispatch<React.SetStateAction<MovementDraft | null>>;
  stockError: string;
  stockSaving: boolean;
  warehouseId?: string;
  warehouseName?: string;
  structureMenuActionsEnabled: boolean;
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
  onUploadItemPhoto?: (context: ItemContextMenu, file: File) => void | Promise<void>;
  onClearItemPhoto?: (context: ItemContextMenu) => void | Promise<void>;
  photoUploading?: boolean;
  onUpdateItemUnit?: (
    context: ItemContextMenu,
    unit: string,
  ) => boolean | Promise<boolean>;
  unitSaving?: boolean;
  onOpenBinPlacement?: (context: ItemContextMenu) => void;
};

const movementFieldClass = `${inputClass} h-10 w-full min-w-0 text-sm`;

export function InventoryItemContextMenu({
  itemContextMenu,
  setItemContextMenu,
  movementDraft,
  setMovementDraft,
  stockError,
  stockSaving,
  warehouseId,
  warehouseName,
  structureMenuActionsEnabled,
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
  onUploadItemPhoto,
  onClearItemPhoto,
  photoUploading = false,
  onUpdateItemUnit,
  unitSaving = false,
  onOpenBinPlacement,
}: InventoryItemContextMenuProps) {
  const [mounted, setMounted] = useState(false);
  const [unitEditor, setUnitEditor] = useState<{
    context: ItemContextMenu;
    value: string;
  } | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (!itemContextMenu) {
      return;
    }

    const closeMenu = () => setItemContextMenu(null);

    const closeMenuOnPointerDown = (event: Event) => {
      if (event instanceof PointerEvent && event.button === 2) {
        return;
      }

      const target = event.target;

      if (
        target instanceof Element &&
        target.closest(`[${INVENTORY_ITEM_CONTEXT_MENU_ATTR}]`)
      ) {
        return;
      }

      closeMenu();
    };

    window.addEventListener("pointerdown", closeMenuOnPointerDown);
    window.addEventListener("scroll", closeMenu, true);

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
    }

    window.addEventListener("keydown", handleKey);

    return () => {
      window.removeEventListener("pointerdown", closeMenuOnPointerDown);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("keydown", handleKey);
    };
  }, [itemContextMenu, setItemContextMenu]);

  const contextMenuPanel =
    itemContextMenu && mounted ? (
      <div
        data-inventory-item-context-menu
        className="fixed z-[145] w-56 rounded-lg border border-black bg-[#17211d] p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
        style={{ left: itemContextMenu.x, top: itemContextMenu.y }}
        onPointerDown={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.preventDefault()}
      >
          <div className="border-b border-white/10 px-2 py-2">
            <p className="truncate text-sm font-black text-[#f8fafc]">
              {itemContextMenu.treeItem.name}
            </p>
            <p className="text-xs font-bold text-slate-400">
              {itemContextMenu.stockItem.stock}{" "}
              {formatInventoryStockLabel(
                itemContextMenu.stockItem,
                itemContextMenu.stockItem.stock,
              )}
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
          {onUploadItemPhoto ? (
            <>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];

                  if (file && itemContextMenu) {
                    void onUploadItemPhoto(itemContextMenu, file);
                  }

                  event.currentTarget.value = "";
                }}
              />
              <button
                type="button"
                disabled={photoUploading}
                onClick={() => photoInputRef.current?.click()}
                className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm font-black text-slate-200 hover:bg-surface-card-hover disabled:opacity-50"
              >
                {photoUploading ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" aria-hidden />
                ) : (
                  <ImagePlus className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                )}
                {itemContextMenu.stockItem.photoUrl ? "Cambiar foto" : "Agregar foto"}
              </button>
              {itemContextMenu.stockItem.photoUrl && onClearItemPhoto ? (
                <button
                  type="button"
                  disabled={photoUploading}
                  onClick={() => {
                    void onClearItemPhoto(itemContextMenu);
                  }}
                  className="flex h-9 w-full items-center rounded-md px-2 text-left text-sm font-black text-rose-200 hover:bg-rose-400/10 disabled:opacity-50"
                >
                  Quitar foto
                </button>
              ) : null}
            </>
          ) : null}
          {onUpdateItemUnit ? (
            <button
              type="button"
              disabled={unitSaving}
              onClick={() => {
                setUnitEditor({
                  context: itemContextMenu,
                  value: resolveInventoryItemUnit(itemContextMenu.stockItem),
                });
                setItemContextMenu(null);
              }}
              className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm font-black text-slate-200 hover:bg-surface-card-hover disabled:opacity-50"
            >
              <Ruler className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              Unidad de medida
            </button>
          ) : null}
          {warehouseId && onOpenBinPlacement ? (
            <button
              type="button"
              onClick={() => {
                if (itemContextMenu) {
                  onOpenBinPlacement(itemContextMenu);
                  setItemContextMenu(null);
                }
              }}
              className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm font-black text-slate-200 hover:bg-surface-card-hover"
            >
              <MapPin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              Ubicación en bodega
            </button>
          ) : null}
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
          {structureMenuActionsEnabled ? (
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
    ) : null;

  return (
    <>
      {contextMenuPanel ? createPortal(contextMenuPanel, document.body) : null}

      {movementDraft && mounted
        ? createPortal(
            <div
              className="fixed inset-0 z-[150] flex items-center justify-center bg-black/45 p-4"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setMovementDraft(null);
                }
              }}
            >
          <form
            className="w-full max-w-md rounded-xl border border-black bg-[#17211d] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
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
            <label className="grid min-w-0 gap-1.5 text-xs font-black uppercase text-slate-400">
              Cantidad (
              {resolveInventoryItemUnit(movementDraft.context.stockItem)})
              <input
                className={movementFieldClass}
                type="number"
                min={movementDraft.type === "ajuste" ? 0 : 1}
                step="1"
                value={movementDraft.qty}
                onChange={(event) =>
                  setMovementDraft((current) => {
                    if (!current) {
                      return current;
                    }

                    const nextQty = event.target.value;
                    const synced = syncEntryCostFields({
                      qty: nextQty,
                      unitCost: current.unitCost || "",
                      totalCost: current.totalCost || "",
                      anchor: "qty",
                    });

                    return {
                      ...current,
                      qty: nextQty,
                      unitCost: synced.unitCost,
                      totalCost: synced.totalCost,
                    };
                  })
                }
                autoFocus
              />
            </label>
            {movementDraft.type === "entrada" ? (
              <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 min-[30rem]:grid-cols-2">
                <label className="grid min-w-0 gap-1.5 text-xs font-black uppercase leading-snug text-slate-400">
                  Costo total del lote
                  <input
                    className={movementFieldClass}
                    type="number"
                    min="0"
                    step="0.01"
                    value={movementDraft.totalCost || ""}
                    onChange={(event) =>
                      setMovementDraft((current) => {
                        if (!current) {
                          return current;
                        }

                        const nextTotalCost = event.target.value;
                        const synced = syncEntryCostFields({
                          qty: current.qty,
                          unitCost: current.unitCost || "",
                          totalCost: nextTotalCost,
                          anchor: "total",
                        });

                        return {
                          ...current,
                          totalCost: nextTotalCost,
                          unitCost: synced.unitCost,
                          entryCostAnchor: "total",
                        };
                      })
                    }
                    placeholder="Opcional"
                  />
                </label>
                <label className="grid min-w-0 gap-1.5 text-xs font-black uppercase leading-snug text-slate-400">
                  Costo unitario
                  <input
                    className={movementFieldClass}
                    type="number"
                    min="0"
                    step="0.0001"
                    value={movementDraft.unitCost || ""}
                    onChange={(event) =>
                      setMovementDraft((current) => {
                        if (!current) {
                          return current;
                        }

                        const nextUnitCost = event.target.value;
                        const synced = syncEntryCostFields({
                          qty: current.qty,
                          unitCost: nextUnitCost,
                          totalCost: current.totalCost || "",
                          anchor: "unit",
                        });

                        return {
                          ...current,
                          unitCost: nextUnitCost,
                          totalCost: synced.totalCost,
                          entryCostAnchor: "unit",
                        };
                      })
                    }
                    placeholder="Opcional"
                  />
                </label>
              </div>
            ) : null}
            <label className="mt-3 grid min-w-0 gap-1.5 text-xs font-black uppercase text-slate-400">
              Motivo
              <select
                className={movementFieldClass}
                value={movementDraft.reasonCode}
                onChange={(event) =>
                  setMovementDraft((current) =>
                    current
                      ? {
                          ...current,
                          reasonCode: event.target.value as MovementDraft["reasonCode"],
                        }
                      : current,
                  )
                }
              >
                {manualMovementReasonOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 grid min-w-0 gap-1.5 text-xs font-black uppercase text-slate-400">
              Detalle
              <input
                className={movementFieldClass}
                value={movementDraft.note}
                onChange={(event) =>
                  setMovementDraft((current) =>
                    current ? { ...current, note: event.target.value } : current,
                  )
                }
                placeholder={
                  movementReasonRequiresDetail(movementDraft.reasonCode)
                    ? "Requerido"
                    : "Opcional"
                }
                required={movementReasonRequiresDetail(movementDraft.reasonCode)}
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
            </div>,
            document.body,
          )
        : null}

      {unitEditor && mounted
        ? createPortal(
            <div
              className="fixed inset-0 z-[150] flex items-center justify-center bg-black/45 p-4"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setUnitEditor(null);
                }
              }}
            >
              <form
                className="w-full max-w-sm rounded-xl border border-black bg-[#17211d] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
                onSubmit={(event) => {
                  event.preventDefault();

                  if (!onUpdateItemUnit) {
                    return;
                  }

                  void (async () => {
                    const saved = await onUpdateItemUnit(
                      unitEditor.context,
                      normalizeInventoryUnit(unitEditor.value),
                    );

                    if (saved) {
                      setUnitEditor(null);
                    }
                  })();
                }}
              >
                <div className="mb-3">
                  <p className="text-lg font-black text-[#f8fafc]">
                    Unidad de medida
                  </p>
                  <p className="truncate text-sm font-bold text-slate-400">
                    {unitEditor.context.treeItem.name}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {INVENTORY_UNIT_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() =>
                        setUnitEditor((current) =>
                          current ? { ...current, value: preset } : current,
                        )
                      }
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-black capitalize ${
                        normalizeInventoryUnit(unitEditor.value) === preset
                          ? "border-emerald-500 bg-emerald-400/10 text-emerald-200"
                          : "border-black bg-surface-inset text-slate-300 hover:bg-surface-card-hover"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <label className="mt-3 grid gap-1.5 text-xs font-black uppercase text-slate-400">
                  Personalizada
                  <input
                    className={`${inputClass} h-10 text-sm`}
                    value={unitEditor.value}
                    onChange={(event) =>
                      setUnitEditor((current) =>
                        current
                          ? { ...current, value: event.target.value }
                          : current,
                      )
                    }
                    placeholder="ej. pieza, rollo, kg"
                    maxLength={24}
                    autoFocus
                  />
                </label>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setUnitEditor(null)}
                    className="h-10 rounded-lg border border-black bg-surface-inset px-3 text-sm font-black text-slate-300 hover:bg-surface-card-hover"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={unitSaving || !normalizeInventoryUnit(unitEditor.value)}
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-400 px-4 text-sm font-black text-slate-950 disabled:opacity-60"
                  >
                    {unitSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Guardar
                  </button>
                </div>
              </form>
            </div>,
            document.body,
          )
        : null}

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
