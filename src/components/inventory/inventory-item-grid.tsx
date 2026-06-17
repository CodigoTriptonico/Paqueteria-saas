"use client";

import {
  Box,
  Check,
  ChevronLeft,
  ChevronRight,
  Layers3,
  Package2,
  Plus,
  Search,
  X,
} from "lucide-react";
import { type MouseEvent } from "react";
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
  itemsGridClass,
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
  const leafStockItems =
    leafItems.length > 0
      ? leafItems
      : [
          {
            id: `virtual-leaf-${item.id}`,
            name: item.name,
            category: selectedCategoryData.name,
            kind: item.name,
            subcategory: selectedSubcategory?.name,
            stock: 0,
            reserved: 0,
            assigned: 0,
            unavailable: 0,
            minStock: 2,
          },
        ];
  const stockItem = leafStockItems[0];
  const metrics = leafStockMetrics(leafStockItems);
  const stockLevel = metrics.level;

  return (
    <article
      key={item.id}
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

type InventorySubcategoryGroupCardProps = {
  subcategory: InventoryTreeItem;
  selectedCategoryData: CategoryConfig;
  onSelectSubcategory: (id: string) => void;
  subcategoryStockItems: (
    category: CategoryConfig,
    subcategoryName: string,
    childKindNames: string[],
  ) => InventoryStockItem[];
};

function InventorySubcategoryGroupCard({
  subcategory,
  selectedCategoryData,
  onSelectSubcategory,
  subcategoryStockItems,
}: InventorySubcategoryGroupCardProps) {
  const children = subcategory.children || [];
  const stockItems = subcategoryStockItems(
    selectedCategoryData,
    subcategory.name,
    children.map((child) => child.name),
  );
  const metrics = leafStockMetrics(stockItems);

  return (
    <button
      key={subcategory.id}
      type="button"
      onClick={() => onSelectSubcategory(subcategory.id)}
      className="group flex min-h-[8.5rem] w-full cursor-pointer flex-col rounded-xl border border-black bg-[#36433e] p-4 text-left shadow-[0_6px_20px_rgba(0,0,0,0.22)] transition hover:bg-[#3d4b45] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
    >
      <div className="flex items-start gap-3">
        <span className={`h-10 w-10 shrink-0 ${iconWellEmerald}`}>
          <Layers3 className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-black capitalize text-[#f8fafc]">
            {subcategory.name}
          </p>
          <p className="mt-0.5 text-xs font-bold text-slate-400">
            {children.length} {children.length === 1 ? "item" : "items"} dentro
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-500 transition group-hover:text-emerald-300" />
      </div>
      <div className="mt-4 flex items-center justify-between text-xs font-bold text-slate-400">
        <span>Subcategoría</span>
        <span className="tabular-nums text-emerald-300">{metrics.warehouse} en bodega</span>
      </div>
    </button>
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
  subcategories: InventoryTreeItem[];
  itemQueryTrimmed: string;
  itemQueryActive: boolean;
  showSubcategoryGroups: boolean;
  itemCountLabel: string;
  leafEntryByItemId: Map<string, CategoryLeafEntry>;
  inventoryItems: InventoryStockItem[];
  editingItemId: string;
  editingItemName: string;
  setEditingItemName: (value: string) => void;
  setEditingItemId: (value: string) => void;
  showStructureOptions: boolean;
  showNewItemForm: boolean;
  setShowNewItemForm: (value: boolean) => void;
  newNameByKey: Record<string, string>;
  setNewNameByKey: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  itemInputKey: string;
  itemPlaceholder: string;
  addingSubcategoryForSelectedCategory: boolean;
  exitSubcategory: () => void;
  beginAddItem: () => void;
  beginAddSubcategory: () => void;
  addItem: () => void;
  renderSubcategoryForm: (compact?: boolean) => React.ReactNode;
  onItemContextMenu: (
    event: MouseEvent<HTMLElement>,
    item: InventoryTreeItem,
    stockItem: InventoryStockItem,
  ) => void;
  onSelectSubcategory: (id: string) => void;
  onSaveItem: (categoryName: string, itemId: string) => void;
  subcategoryStockItems: (
    category: CategoryConfig,
    subcategoryName: string,
    childKindNames: string[],
  ) => InventoryStockItem[];
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
  subcategories,
  itemQueryTrimmed,
  itemQueryActive,
  showSubcategoryGroups,
  itemCountLabel,
  leafEntryByItemId,
  inventoryItems,
  editingItemId,
  editingItemName,
  setEditingItemName,
  setEditingItemId,
  showStructureOptions,
  showNewItemForm,
  setShowNewItemForm,
  newNameByKey,
  setNewNameByKey,
  itemInputKey,
  itemPlaceholder,
  addingSubcategoryForSelectedCategory,
  exitSubcategory,
  beginAddItem,
  beginAddSubcategory,
  addItem,
  renderSubcategoryForm,
  onItemContextMenu,
  onSelectSubcategory,
  onSaveItem,
  subcategoryStockItems,
}: InventoryItemGridProps) {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
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
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
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

            {!selectedSubcategory && subcategories.length && !itemQueryActive ? (
              <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-3 py-2">
                <p className="text-xs text-slate-300">
                  Los items dentro de una subcategoría solo se ven al abrirla. Aquí
                  aparecen las carpetas y los items sueltos de{" "}
                  {selectedCategoryData.name}.
                </p>
              </div>
            ) : null}

            {showSubcategoryGroups ? (
              <div className="grid gap-2">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Subcategorías
                </p>
                <div className={itemsGridClass}>
                  {subcategories.map((subcategory) => (
                    <InventorySubcategoryGroupCard
                      key={subcategory.id}
                      subcategory={subcategory}
                      selectedCategoryData={selectedCategoryData}
                      onSelectSubcategory={onSelectSubcategory}
                      subcategoryStockItems={subcategoryStockItems}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {filteredItems.length ? (
              <div className="grid gap-2">
                {showSubcategoryGroups ? (
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Items en {selectedCategoryData.name}
                  </p>
                ) : null}
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
            ) : showSubcategoryGroups ? (
              <div className="py-6 text-center">
                <p className="text-sm font-bold text-slate-400">
                  Sin items sueltos en {selectedCategoryData.name}. Abre una
                  subcategoría o agrégalos aquí.
                </p>
                {showStructureOptions ? (
                  <button
                    type="button"
                    onClick={beginAddItem}
                    className={`${secondaryButtonClass} mx-auto mt-4 text-xs`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agregar item suelto
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="grid gap-3 py-12 text-center">
                <p className="text-lg font-black text-[#f8fafc]">Sin items todavía</p>
                <p className="text-sm font-bold text-slate-300">
                  {selectedSubcategory
                    ? "Agrega variantes como rojo, azul o aislante."
                    : `Agrega medidas o variantes en ${selectedCategoryData.name} (ej. 14x14x14).`}
                </p>
                {showStructureOptions ? (
                  showNewItemForm && selectedCategoryData ? (
                    <div className="mx-auto mt-2 w-full max-w-md space-y-2">
                      <div className="flex items-center gap-2 rounded-xl border border-black bg-[#111827] p-2">
                        <button
                          type="button"
                          onClick={() => addItem()}
                          className={addBtnClass}
                          title="Agregar item"
                          aria-label="Agregar item"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <input
                          className="h-10 min-w-0 flex-1 bg-transparent px-2 text-sm font-black text-[#f8fafc] outline-none placeholder:text-slate-500"
                          placeholder={itemPlaceholder}
                          value={newNameByKey[itemInputKey] || ""}
                          onChange={(event) =>
                            setNewNameByKey((current) => ({
                              ...current,
                              [itemInputKey]: event.target.value,
                            }))
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              addItem();
                            }
                          }}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewItemForm(false)}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-surface-card-hover hover:text-[#f8fafc]"
                          title="Cancelar"
                          aria-label="Cancelar"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                      <p className="text-xs font-bold text-slate-500">
                        En{" "}
                        {selectedSubcategory
                          ? `${selectedCategoryData.name} › ${selectedSubcategory.name}`
                          : selectedCategoryData.name}
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={beginAddItem}
                      className={`${primaryButtonClass} mx-auto`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Agregar item
                    </button>
                  )
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
                      Agrupa variantes dentro de {selectedCategoryData.name} (ej.
                      colores, materiales).
                    </p>
                  </div>
                ) : addingSubcategoryForSelectedCategory ? (
                  <div className="mx-auto mt-2 w-full max-w-md">
                    {renderSubcategoryForm()}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
