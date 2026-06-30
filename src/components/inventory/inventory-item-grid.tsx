"use client";

import {
  Box,
  Check,
  ChevronLeft,
  Package2,
  Plus,
  Search,
  X,
} from "lucide-react";
import { type MouseEvent, useEffect, useRef, useState } from "react";
import {
  InventoryEmptyContextMenu,
  type InventoryEmptyContextMenuState,
} from "@/components/inventory/inventory-empty-context-menu";
import { InlineSearchCombobox } from "@/components/inline-search-picker";
import {
  iconWellEmerald,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui-blocks";
import {
  inventoryItemsForLeaf,
  leafStockMetrics,
  stockBadgeToneClass,
  stockCardClass,
  stockStatusLabel,
  stockValueToneClass,
  type InventoryStockItem,
} from "@/lib/inventory-stock";
import {
  addBtnClass,
  iconBtnClass,
  INVENTORY_ITEM_CARD_SELECTOR,
  INVENTORY_ITEMS_SURFACE_SELECTOR,
  INTERACTIVE_SELECTOR,
  itemsGridClass,
  stockItemForTreeItem,
  type CategoryLeafEntry,
} from "@/lib/inventory-structure-utils";
import { type CategoryConfig, type InventoryTreeItem } from "@/lib/inventory-tree";

type InventoryItemCardProps = {
  item: InventoryTreeItem;
  selectedCategoryData: CategoryConfig;
  selectedSubcategory: InventoryTreeItem | null;
  inventoryItems: InventoryStockItem[];
  editingItemId: string;
  editingItemName: string;
  setEditingItemName: (value: string) => void;
  setEditingItemId: (value: string) => void;
  itemQueryActive: boolean;
  leafEntryByItemId: Map<string, CategoryLeafEntry>;
  onContextMenu: (
    event: MouseEvent<HTMLElement>,
    item: InventoryTreeItem,
    stockItem: InventoryStockItem,
  ) => void;
  onSaveItem: (categoryName: string, itemId: string) => void;
};

function InventoryItemCard({
  item,
  selectedCategoryData,
  selectedSubcategory,
  inventoryItems,
  editingItemId,
  editingItemName,
  setEditingItemName,
  setEditingItemId,
  itemQueryActive,
  leafEntryByItemId,
  onContextMenu,
  onSaveItem,
}: InventoryItemCardProps) {
  const editing = editingItemId === item.id;
  const leafItems = inventoryItemsForLeaf(
    inventoryItems,
    selectedCategoryData.name,
    item.name,
    selectedSubcategory?.name,
  );
  const stockItem = stockItemForTreeItem(
    inventoryItems,
    selectedCategoryData.name,
    item,
    selectedSubcategory?.name,
  );
  const metrics = leafStockMetrics(
    leafItems.length > 0
      ? leafItems
      : [stockItem],
  );
  const stockLevel = metrics.level;

  return (
    <article
      key={item.id}
      data-inventory-item-id={item.id}
      onContextMenu={(event) => onContextMenu(event, item, stockItem)}
      className={`cursor-context-menu rounded-xl border p-4 transition ${stockCardClass[stockLevel]}`}
    >
      <div className="flex items-start gap-3">
        <span className={`h-10 w-10 shrink-0 ${iconWellEmerald}`}>
          <Package2 className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              className={`${inputClass} h-9 w-full text-sm`}
              value={editingItemName}
              onChange={(event) => setEditingItemName(event.target.value)}
              autoFocus
            />
          ) : (
            <p className="truncate text-base font-black leading-tight text-[#f8fafc]">
              {item.name}
            </p>
          )}
          {selectedSubcategory ? (
            <p className="mt-0.5 truncate text-xs font-bold capitalize text-slate-500">
              {selectedSubcategory.name}
            </p>
          ) : itemQueryActive && leafEntryByItemId.get(item.id)?.subcategoryName ? (
            <p className="mt-0.5 truncate text-xs font-bold capitalize text-slate-500">
              {leafEntryByItemId.get(item.id)?.subcategoryName}
            </p>
          ) : null}
        </div>
        {!editing ? (
          <span
            className={`shrink-0 rounded-lg border px-2 py-1 text-[10px] font-black uppercase tracking-wide ${stockBadgeToneClass[stockLevel]}`}
          >
            {stockStatusLabel[stockLevel]}
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid w-full grid-cols-3 overflow-hidden rounded-lg border border-black bg-surface-card-header">
        <div className="flex min-w-0 flex-col items-center justify-center border-r border-black px-2 py-3 sm:px-3">
          <p
            className={`text-2xl font-black tabular-nums leading-none ${stockValueToneClass[stockLevel]}`}
          >
            {metrics.warehouse}
          </p>
          <p
            className="mt-2 whitespace-nowrap text-[10px] font-bold uppercase tracking-wide text-emerald-400/90"
            title="En bodega"
          >
            Bodega
          </p>
        </div>
        <div className="flex min-w-0 flex-col items-center justify-center border-r border-black px-2 py-3 sm:px-3">
          <p className="text-2xl font-black tabular-nums leading-none text-sky-300">
            {metrics.assigned}
          </p>
          <p
            className="mt-2 whitespace-nowrap text-[10px] font-bold uppercase tracking-wide text-sky-400/90"
            title="Con empleados"
          >
            Asignado
          </p>
        </div>
        <div className="flex min-w-0 flex-col items-center justify-center px-2 py-3 sm:px-3">
          <p className="text-2xl font-black tabular-nums leading-none text-rose-300">
            {metrics.unavailable}
          </p>
          <p
            className="mt-2 whitespace-nowrap text-[10px] font-bold uppercase tracking-wide text-rose-400/90"
            title="No disponible"
          >
            No disp.
          </p>
        </div>
      </div>

      {editing ? (
        <div className="mt-3 flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => onSaveItem(selectedCategoryData.name, item.id)}
            className={addBtnClass}
            title="Guardar"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingItemId("");
              setEditingItemName("");
            }}
            className={iconBtnClass}
            title="Cancelar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
    </article>
  );
}

export type InventoryItemGridProps = {
  embedded: boolean;
  selectedCategoryData: CategoryConfig | null;
  selectedSubcategory: InventoryTreeItem | null;
  panelTitle: string;
  itemQuery: string;
  setItemQuery: (value: string) => void;
  embeddedItemOptions: Array<{
    value: string;
    label: string;
    icon?: React.ReactNode;
    trailing?: React.ReactNode;
  }>;
  scopedItems: InventoryTreeItem[];
  filteredItems: InventoryTreeItem[];
  itemQueryTrimmed: string;
  itemQueryActive: boolean;
  itemCountLabel: string;
  leafEntryByItemId: Map<string, CategoryLeafEntry>;
  inventoryItems: InventoryStockItem[];
  editingItemId: string;
  editingItemName: string;
  setEditingItemName: (value: string) => void;
  setEditingItemId: (value: string) => void;
  showStructureOptions: boolean;
  showNewItemForm: boolean;
  addingSubcategoryForSelectedCategory: boolean;
  exitSubcategory: () => void;
  beginAddItem: () => void;
  beginAddSubcategory: () => void;
  beginAddCategory: () => void;
  onItemContextMenu: (
    event: MouseEvent<HTMLElement>,
    item: InventoryTreeItem,
    stockItem: InventoryStockItem,
  ) => void;
  onSaveItem: (categoryName: string, itemId: string) => void;
};

export function InventoryItemGrid({
  embedded,
  selectedCategoryData,
  selectedSubcategory,
  panelTitle,
  itemQuery,
  setItemQuery,
  embeddedItemOptions,
  scopedItems,
  filteredItems,
  itemQueryTrimmed,
  itemQueryActive,
  itemCountLabel,
  leafEntryByItemId,
  inventoryItems,
  editingItemId,
  editingItemName,
  setEditingItemName,
  setEditingItemId,
  showStructureOptions,
  showNewItemForm,
  addingSubcategoryForSelectedCategory,
  exitSubcategory,
  beginAddItem,
  beginAddSubcategory,
  beginAddCategory,
  onItemContextMenu,
  onSaveItem,
}: InventoryItemGridProps) {
  const [emptyContextMenu, setEmptyContextMenu] =
    useState<InventoryEmptyContextMenuState | null>(null);
  const onItemContextMenuRef = useRef(onItemContextMenu);
  const contextMenuDataRef = useRef({
    filteredItems,
    inventoryItems,
    selectedCategoryData,
    selectedSubcategory,
    showStructureOptions,
  });
  const structureActionsRef = useRef({
    beginAddItem,
    beginAddSubcategory,
    beginAddCategory,
    setEmptyContextMenu,
  });

  useEffect(() => {
    onItemContextMenuRef.current = onItemContextMenu;
    contextMenuDataRef.current = {
      filteredItems,
      inventoryItems,
      selectedCategoryData,
      selectedSubcategory,
      showStructureOptions,
    };
    structureActionsRef.current = {
      beginAddItem,
      beginAddSubcategory,
      beginAddCategory,
      setEmptyContextMenu,
    };
  }, [
    beginAddCategory,
    beginAddItem,
    beginAddSubcategory,
    filteredItems,
    inventoryItems,
    onItemContextMenu,
    selectedCategoryData,
    selectedSubcategory,
    showStructureOptions,
  ]);

  useEffect(() => {
    function openContextMenuFromNativeEvent(event: globalThis.MouseEvent) {
      if (event.type !== "contextmenu" && event.button !== 2) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const card = target.closest<HTMLElement>(INVENTORY_ITEM_CARD_SELECTOR);

      if (card) {
        const itemId = card.dataset.inventoryItemId;

        if (!itemId) {
          return;
        }

        const {
          filteredItems: items,
          inventoryItems: stockItems,
          selectedCategoryData: category,
          selectedSubcategory: subcategory,
        } = contextMenuDataRef.current;

        if (!category) {
          return;
        }

        const item = items.find((entry) => entry.id === itemId);

        if (!item) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        structureActionsRef.current.setEmptyContextMenu(null);

        onItemContextMenuRef.current(
          event as unknown as MouseEvent<HTMLElement>,
          item,
          stockItemForTreeItem(
            stockItems,
            category.name,
            item,
            subcategory?.name,
          ),
        );
        return;
      }

      const surface = target.closest(INVENTORY_ITEMS_SURFACE_SELECTOR);

      if (!surface) {
        return;
      }

      if (target.closest(INTERACTIVE_SELECTOR)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const { showStructureOptions: canEditStructure } = contextMenuDataRef.current;

      if (!canEditStructure) {
        return;
      }

      structureActionsRef.current.setEmptyContextMenu({
        x: event.clientX,
        y: event.clientY,
      });
    }

    document.addEventListener("contextmenu", openContextMenuFromNativeEvent, true);
    document.addEventListener("pointerup", openContextMenuFromNativeEvent, true);
    document.addEventListener("mouseup", openContextMenuFromNativeEvent, true);

    return () => {
      document.removeEventListener("contextmenu", openContextMenuFromNativeEvent, true);
      document.removeEventListener("pointerup", openContextMenuFromNativeEvent, true);
      document.removeEventListener("mouseup", openContextMenuFromNativeEvent, true);
    };
  }, []);

  return (
    <section
      data-inventory-items-surface
      className="flex min-h-0 min-w-0 flex-1 flex-col"
    >
      {!embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/70 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {selectedSubcategory ? (
              <button
                type="button"
                onClick={exitSubcategory}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black bg-[#111827] text-slate-300 transition hover:bg-surface-card-hover hover:text-[#f8fafc]"
                title={`Volver a ${selectedCategoryData?.name}`}
                aria-label={`Volver a ${selectedCategoryData?.name}`}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-black capitalize text-[#f8fafc]">
                {panelTitle}
              </p>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                {selectedCategoryData ? "Stock y variantes" : "Elige una categoría"}
              </p>
            </div>
          </div>
          {selectedCategoryData ? (
            <InlineSearchCombobox
              value={itemQuery}
              onChange={setItemQuery}
              options={
                embeddedItemOptions.length
                  ? embeddedItemOptions
                  : scopedItems.map((item) => ({
                      value: item.id,
                      label: item.name,
                    }))
              }
              placeholder="Buscar item"
              emptyLabel="Sin items"
              ariaLabel="Buscar items"
              leadingIcon={<Search className="h-4 w-4" aria-hidden />}
              className="relative w-full min-w-[12rem] sm:w-56"
              minWidthClass="w-full min-w-0"
            />
          ) : null}
        </div>
      ) : null}
      <div className="min-h-full flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        {embedded && selectedSubcategory && selectedCategoryData ? (
          <div className="mb-4 flex items-center gap-2 border-b border-black/50 pb-3">
            <button
              type="button"
              onClick={exitSubcategory}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black bg-[#111827] text-slate-300 transition hover:bg-surface-card-hover hover:text-[#f8fafc]"
              title={`Volver a ${selectedCategoryData.name}`}
              aria-label={`Volver a ${selectedCategoryData.name}`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-black capitalize text-[#f8fafc]">
                {selectedSubcategory.name}
              </p>
              <p className="truncate text-xs font-bold text-slate-500">
                en {selectedCategoryData.name}
              </p>
            </div>
          </div>
        ) : null}
        {!selectedCategoryData ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-emerald-600/40 bg-emerald-400/10 text-emerald-300">
              <Box className="h-5 w-5" />
            </span>
            <p className="mt-3 text-base font-black text-[#f8fafc]">
              Selecciona una categoría
            </p>
            <p className="mt-1 max-w-xs text-sm font-bold text-slate-400">
              {embedded
                ? "Elige una categoría en el desplegable para ver items y stock."
                : "Elige una categoría a la izquierda para ver items y stock."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {!embedded ? (
              <p className="text-xs font-medium text-slate-300">
                {itemCountLabel}
                {itemQueryActive
                  ? ` · ${filteredItems.length} coincide${filteredItems.length === 1 ? "" : "n"} con "${itemQueryTrimmed}"`
                  : ""}
              </p>
            ) : null}

            {filteredItems.length ? (
              <div className="grid gap-2">
                <div className={itemsGridClass}>
                  {filteredItems.map((item) => (
                    <InventoryItemCard
                      key={item.id}
                      item={item}
                      selectedCategoryData={selectedCategoryData}
                      selectedSubcategory={selectedSubcategory}
                      inventoryItems={inventoryItems}
                      editingItemId={editingItemId}
                      editingItemName={editingItemName}
                      setEditingItemName={setEditingItemName}
                      setEditingItemId={setEditingItemId}
                      itemQueryActive={itemQueryActive}
                      leafEntryByItemId={leafEntryByItemId}
                      onContextMenu={onItemContextMenu}
                      onSaveItem={onSaveItem}
                    />
                  ))}
                </div>
              </div>
            ) : itemQueryActive ? (
              <div className="grid gap-3 py-12 text-center">
                <p className="text-lg font-black text-[#f8fafc]">Sin coincidencias</p>
                <p className="text-sm font-bold text-slate-300">
                  Ningún item coincide con &quot;{itemQueryTrimmed}&quot; en esta
                  {selectedSubcategory ? " subcategoría" : " categoría"}.
                </p>
                <button
                  type="button"
                  onClick={() => setItemQuery("")}
                  className="mx-auto text-xs font-semibold text-slate-400 hover:text-slate-200"
                >
                  Limpiar búsqueda
                </button>
              </div>
            ) : (
              <div className="grid gap-3 py-12 text-center">
                <p className="text-lg font-black text-[#f8fafc]">Sin items todavía</p>
                <p className="text-sm font-bold text-slate-300">
                  {selectedSubcategory
                    ? "Agrega variantes como rojo, azul o aislante."
                    : "Agrega items sueltos en esta categoría (ej. 14x14x14, cinta, playera M). Clic derecho aquí para agregar."}
                </p>
                {showStructureOptions && !showNewItemForm ? (
                  <button
                    type="button"
                    onClick={beginAddItem}
                    className={`${primaryButtonClass} mx-auto`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agregar item
                  </button>
                ) : null}
                {!selectedSubcategory &&
                showStructureOptions &&
                !addingSubcategoryForSelectedCategory ? (
                  <div className="mx-auto mt-1 flex max-w-md flex-col items-center gap-2">
                    <button
                      type="button"
                      onClick={beginAddSubcategory}
                      className={`${secondaryButtonClass} text-xs`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Crear subcategoría
                    </button>
                    <p className="text-xs text-slate-400">
                      Agrupa items en subcategorías (ej. colores, materiales,
                      tallas).
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
      <InventoryEmptyContextMenu
        menu={emptyContextMenu}
        onClose={() => setEmptyContextMenu(null)}
        hasCategory={Boolean(selectedCategoryData)}
        inSubcategory={Boolean(selectedSubcategory)}
        onAddItem={beginAddItem}
        onAddSubcategory={beginAddSubcategory}
        onAddCategory={beginAddCategory}
      />
    </section>
  );
}
