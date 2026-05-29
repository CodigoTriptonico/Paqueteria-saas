"use client";

import {
  Box,
  Check,
  ChevronRight,
  Edit3,
  Layers3,
  Package2,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useLayoutEffect, useMemo, useState } from "react";
import { useSetShellConfig } from "@/components/app-frame";
import {
  accentEmeraldSolid,
  cardBodyHeaderClass,
  cardClass,
  iconWellEmerald,
  inputClass,
  Panel,
  primaryButtonClass,
} from "@/components/ui-blocks";
import { StockBadgeDisplay } from "@/components/stock-badge";
import {
  inventoryItemsForLeaf,
  resolveCategoryStockItems,
  resolveSubcategoryStockItems,
  type InventoryStockItem,
} from "@/lib/inventory-stock";
import {
  addInventoryTreeChild,
  categoryDirectItems,
  categoryItems,
  categorySubcategories,
  deleteInventoryTreeItem,
  inventoryTreeItemExists,
  normalizeInventoryText,
  updateInventoryTreeItem,
  type CategoryConfig,
  type InventoryTreeItem,
} from "@/lib/inventory-tree";

type InventoryStructureEditorProps = {
  categoryConfigs: CategoryConfig[];
  onCategoryConfigsChange: (next: CategoryConfig[]) => void;
  inventoryItems?: InventoryStockItem[];
  onInventoryItemsChange?: (next: InventoryStockItem[]) => void;
  layout?: "sidebar" | "inline";
  showCategoryCreate?: boolean;
};

const addBtnClass =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-400 text-slate-950 transition hover:brightness-110";
const iconBtnClass =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-300 transition hover:bg-surface-card-hover hover:text-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-40";
const countBadgeClass =
  "inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md border border-black bg-surface-inset px-1.5 text-[11px] font-semibold tabular-nums text-slate-200";
const categoryCardSelectedClass =
  "border-2 border-emerald-400 bg-surface-card-header shadow-[0_0_0_1px_rgba(52,211,153,0.25),0_4px_14px_rgba(0,0,0,0.22)]";
const subcategoryRowSelectedClass =
  "border-2 border-emerald-400 bg-surface-card-header shadow-[0_0_0_1px_rgba(52,211,153,0.2)]";
const categoryCardClass = (active: boolean) =>
  `overflow-hidden rounded-xl border bg-surface-card transition ${
    active
      ? categoryCardSelectedClass
      : "border-black shadow-[0_4px_14px_rgba(0,0,0,0.2)] hover:bg-surface-card-hover"
  }`;
const categoryHeaderClass = (selected: boolean, hasSubsBelow: boolean) =>
  `group min-w-0 border-black transition ${
    hasSubsBelow ? "border-b" : ""
  } ${selected ? "bg-surface-card-header/60" : "hover:bg-surface-card-hover"}`;
const rowActionsBarClass =
  "flex items-center justify-end gap-0.5 border-t border-black bg-surface-inset/60 px-2 py-1.5";
const subcategoryPanelClass =
  "mx-2 mb-2 flex min-w-0 flex-col gap-1.5 rounded-lg border border-black bg-surface-panel px-2 py-2";
const subcategoryRowClass = (selected: boolean) =>
  `group flex min-w-0 flex-col overflow-hidden rounded-md border bg-surface-card transition ${
    selected ? subcategoryRowSelectedClass : "border-black hover:bg-surface-card-hover"
  }`;

function CountBadge({ count, title }: { count: number; title: string }) {
  return (
    <span className={countBadgeClass} title={title} aria-label={`${count} ${title}`}>
      {count}
    </span>
  );
}

const itemsGridClass =
  "grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]";

export function InventoryStructureEditor({
  categoryConfigs,
  onCategoryConfigsChange,
  inventoryItems = [],
  onInventoryItemsChange,
  layout = "sidebar",
  showCategoryCreate = false,
}: InventoryStructureEditorProps) {
  const setShellConfig = useSetShellConfig();
  const [categoryQuery, setCategoryQuery] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState("");
  const [newNameByKey, setNewNameByKey] = useState<Record<string, string>>({});
  const [openSubcategoryInput, setOpenSubcategoryInput] = useState("");
  const [editingCategory, setEditingCategory] = useState("");
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [editingSubcategoryId, setEditingSubcategoryId] = useState("");
  const [editingSubcategoryName, setEditingSubcategoryName] = useState("");
  const [editingItemId, setEditingItemId] = useState("");
  const [editingItemName, setEditingItemName] = useState("");
  const [showNewItemForm, setShowNewItemForm] = useState(false);

  const categoryNames = useMemo(
    () => categoryConfigs.map((currentCategory) => currentCategory.name),
    [categoryConfigs],
  );

  const filteredCategories = useMemo(() => {
    const query = normalizeInventoryText(categoryQuery.trim());

    return categoryConfigs.filter((currentCategory) =>
      normalizeInventoryText(currentCategory.name).includes(query),
    );
  }, [categoryConfigs, categoryQuery]);

  const selectedCategoryData = useMemo(
    () =>
      categoryConfigs.find((currentCategory) => currentCategory.name === selectedCategory) ||
      null,
    [categoryConfigs, selectedCategory],
  );

  const subcategories = useMemo(
    () => (selectedCategoryData ? categorySubcategories(selectedCategoryData) : []),
    [selectedCategoryData],
  );

  const selectedSubcategory = useMemo(
    () => subcategories.find((item) => item.id === selectedSubcategoryId) || null,
    [subcategories, selectedSubcategoryId],
  );

  const directItems = useMemo(
    () => (selectedCategoryData ? categoryDirectItems(selectedCategoryData) : []),
    [selectedCategoryData],
  );

  const selectedItems = useMemo(() => {
    if (selectedSubcategory) {
      return selectedSubcategory.children || [];
    }

    return directItems;
  }, [selectedSubcategory, directItems]);

  const itemInputKey = selectedSubcategory
    ? `${selectedCategory}:${selectedSubcategory.id}:item`
    : `${selectedCategory}:direct:item`;

  function selectCategory(name: string) {
    setSelectedCategory(name);
    setSelectedSubcategoryId("");
    setShowNewItemForm(false);
    setOpenSubcategoryInput("");
  }

  function selectSubcategory(id: string) {
    setSelectedSubcategoryId(id);
    setShowNewItemForm(false);
  }

  function categoryStockItems(category: CategoryConfig) {
    return resolveCategoryStockItems(inventoryItems, category);
  }

  function subcategoryStockItems(
    category: CategoryConfig,
    subcategoryName: string,
    childKindNames: string[],
  ) {
    return resolveSubcategoryStockItems(
      inventoryItems,
      category,
      subcategoryName,
      childKindNames,
    );
  }

  function pushInventoryItem(item: InventoryStockItem) {
    onInventoryItemsChange?.([...inventoryItems, item]);
  }

  function removeInventoryForLeaf(
    categoryName: string,
    leafName: string,
    subcategoryName?: string,
  ) {
    const matches = inventoryItemsForLeaf(
      inventoryItems,
      categoryName,
      leafName,
      subcategoryName,
    );
    const matchIds = new Set(matches.map((item) => item.id));

    onInventoryItemsChange?.(inventoryItems.filter((item) => !matchIds.has(item.id)));
  }

  function addCategory() {
    const name = newCategoryName.trim();

    if (!name || categoryNames.includes(name)) {
      return;
    }

    onCategoryConfigsChange([...categoryConfigs, { name, items: [] }]);
    selectCategory(name);
    setNewCategoryName("");
  }

  function saveCategory(oldName: string) {
    const name = editingCategoryName.trim();

    if (!name || (name !== oldName && categoryNames.includes(name))) {
      return;
    }

    onCategoryConfigsChange(
      categoryConfigs.map((currentCategory) =>
        currentCategory.name === oldName ? { ...currentCategory, name } : currentCategory,
      ),
    );

    onInventoryItemsChange?.(
      inventoryItems.map((item) =>
        normalizeInventoryText(item.category) === normalizeInventoryText(oldName)
          ? { ...item, category: name }
          : item,
      ),
    );

    if (selectedCategory === oldName) {
      setSelectedCategory(name);
    }

    setEditingCategory("");
    setEditingCategoryName("");
  }

  function deleteCategory(name: string) {
    onCategoryConfigsChange(
      categoryConfigs.filter((currentCategory) => currentCategory.name !== name),
    );

    onInventoryItemsChange?.(
      inventoryItems.filter(
        (item) => normalizeInventoryText(item.category) !== normalizeInventoryText(name),
      ),
    );

    if (selectedCategory === name) {
      const next = categoryConfigs.find((item) => item.name !== name)?.name || "";
      selectCategory(next);
    }
  }

  function addSubcategory(categoryName: string) {
    const subcategoryName = (newNameByKey[categoryName] || "").trim();

    if (!subcategoryName) {
      return;
    }

    let createdId = "";

    onCategoryConfigsChange(
      categoryConfigs.map((currentCategory) => {
        const items = categoryItems(currentCategory);

        if (
          currentCategory.name !== categoryName ||
          inventoryTreeItemExists(items, subcategoryName)
        ) {
          return currentCategory;
        }

        createdId = `${normalizeInventoryText(categoryName).replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;

        return {
          ...currentCategory,
          items: [
            ...items,
            {
              id: createdId,
              name: subcategoryName,
              children: [],
            },
          ],
        };
      }),
    );

    setNewNameByKey((current) => ({ ...current, [categoryName]: "" }));
    setOpenSubcategoryInput("");

    if (createdId && categoryName === selectedCategory) {
      selectSubcategory(createdId);
    }
  }

  function saveSubcategory(categoryName: string, subcategoryId: string) {
    const nextName = editingSubcategoryName.trim();

    if (!nextName) {
      return;
    }

    const categoryData = categoryConfigs.find(
      (currentCategory) => currentCategory.name === categoryName,
    );
    const subcategory =
      (categoryData ? categorySubcategories(categoryData) : []).find(
        (item) => item.id === subcategoryId,
      ) || null;
    const previousName = subcategory?.name || "";

    onCategoryConfigsChange(
      categoryConfigs.map((currentCategory) => {
        if (currentCategory.name !== categoryName) {
          return currentCategory;
        }

        return {
          ...currentCategory,
          items: updateInventoryTreeItem(categoryItems(currentCategory), subcategoryId, nextName),
        };
      }),
    );

    if (previousName && previousName !== nextName) {
      onInventoryItemsChange?.(
        inventoryItems.map((item) =>
          normalizeInventoryText(item.category) === normalizeInventoryText(categoryName) &&
          item.subcategory &&
          normalizeInventoryText(item.subcategory) === normalizeInventoryText(previousName)
            ? { ...item, subcategory: nextName }
            : item,
        ),
      );
    }

    setEditingSubcategoryId("");
    setEditingSubcategoryName("");
  }

  function deleteSubcategory(categoryName: string, subcategoryId: string) {
    onCategoryConfigsChange(
      categoryConfigs.map((currentCategory) =>
        currentCategory.name === categoryName
          ? {
              ...currentCategory,
              items: deleteInventoryTreeItem(categoryItems(currentCategory), subcategoryId),
            }
          : currentCategory,
      ),
    );

    if (selectedSubcategoryId === subcategoryId) {
      setSelectedSubcategoryId("");
    }
  }

  function addItem(categoryName: string, subcategoryId: string | null) {
    const inputKey = subcategoryId
      ? `${categoryName}:${subcategoryId}:item`
      : `${categoryName}:direct:item`;
    const itemName = (newNameByKey[inputKey] || "").trim();

    if (!itemName) {
      return;
    }

    const siblings = subcategoryId
      ? selectedSubcategory?.children || []
      : categoryDirectItems(
          categoryConfigs.find((currentCategory) => currentCategory.name === categoryName) || {
            name: categoryName,
          },
        );

    if (inventoryTreeItemExists(siblings, itemName)) {
      return;
    }

    onCategoryConfigsChange(
      categoryConfigs.map((currentCategory) => {
        if (currentCategory.name !== categoryName) {
          return currentCategory;
        }

        const items = categoryItems(currentCategory);

        if (subcategoryId) {
          return {
            ...currentCategory,
            items: addInventoryTreeChild(items, subcategoryId, {
              id: `${subcategoryId}-${Date.now()}`,
              name: itemName,
            }),
          };
        }

        return {
          ...currentCategory,
          items: [
            ...items,
            {
              id: `${normalizeInventoryText(categoryName).replace(/[^a-z0-9]+/g, "-")}-item-${Date.now()}`,
              name: itemName,
            },
          ],
        };
      }),
    );

    setNewNameByKey((current) => ({ ...current, [inputKey]: "" }));
    setShowNewItemForm(false);

    const subcategoryName = subcategoryId
      ? categoryConfigs
          .find((currentCategory) => currentCategory.name === categoryName)
          ?.items?.find((item) => item.id === subcategoryId)?.name
      : undefined;

    pushInventoryItem({
      id: `inv-${Date.now()}`,
      name: itemName,
      category: categoryName,
      kind: itemName,
      subcategory: subcategoryName,
      stock: 0,
      reserved: 0,
      minStock: 2,
    });
  }

  function saveItem(categoryName: string, itemId: string) {
    const nextName = editingItemName.trim();

    if (!nextName) {
      return;
    }

    const previousItem = selectedItems.find((item) => item.id === itemId);

    onCategoryConfigsChange(
      categoryConfigs.map((currentCategory) => {
        if (currentCategory.name !== categoryName) {
          return currentCategory;
        }

        return {
          ...currentCategory,
          items: updateInventoryTreeItem(categoryItems(currentCategory), itemId, nextName),
        };
      }),
    );

    if (previousItem && previousItem.name !== nextName) {
      onInventoryItemsChange?.(
        inventoryItems.map((item) => {
          const leafMatches = inventoryItemsForLeaf(
            inventoryItems,
            categoryName,
            previousItem.name,
            selectedSubcategory?.name,
          ).some((match) => match.id === item.id);

          if (!leafMatches) {
            return item;
          }

          return { ...item, name: nextName, kind: nextName };
        }),
      );
    }

    setEditingItemId("");
    setEditingItemName("");
  }

  function deleteItem(categoryName: string, itemId: string) {
    const treeItem = selectedItems.find((entry) => entry.id === itemId);

    onCategoryConfigsChange(
      categoryConfigs.map((currentCategory) =>
        currentCategory.name === categoryName
          ? {
              ...currentCategory,
              items: deleteInventoryTreeItem(categoryItems(currentCategory), itemId),
            }
          : currentCategory,
      ),
    );

    if (treeItem) {
      removeInventoryForLeaf(categoryName, treeItem.name, selectedSubcategory?.name);
    }
  }

  function renderItemCard(item: InventoryTreeItem) {
    if (!selectedCategoryData) {
      return null;
    }

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
              minStock: 2,
            },
          ];
    return (
      <article key={item.id} className={`${cardClass} flex flex-col p-0`}>
        <div className={`${cardBodyHeaderClass} rounded-t-xl px-4 py-3`}>
          <div className="flex items-start justify-between gap-2">
            <span className={`h-9 w-9 shrink-0 ${iconWellEmerald}`}>
              <Package2 className="h-4 w-4" />
            </span>
            <StockBadgeDisplay items={leafStockItems} title="Stock disponible" />
          </div>
          {editing ? (
            <input
              className={`${inputClass} mt-2 h-9 w-full text-sm`}
              value={editingItemName}
              onChange={(event) => setEditingItemName(event.target.value)}
              autoFocus
            />
          ) : (
            <p className="mt-2 truncate text-base font-black text-[#f8fafc]">{item.name}</p>
          )}
          <p className="mt-0.5 text-[10px] font-black uppercase text-slate-500">Item</p>
        </div>

        <div className="flex items-center gap-1 p-3">
          {editing ? (
            <>
              <button
                type="button"
                onClick={() => saveItem(selectedCategoryData.name, item.id)}
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
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditingItemId(item.id);
                  setEditingItemName(item.name);
                }}
                className={iconBtnClass}
                title="Editar"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => deleteItem(selectedCategoryData.name, item.id)}
                className={iconBtnClass}
                title="Borrar"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </article>
    );
  }

  const categorySidebar = useMemo(
    () => (
      <div className={`${cardClass} flex min-h-0 flex-1 flex-col overflow-hidden p-0`}>
        <div className={`${cardBodyHeaderClass} px-3 py-2.5`}>
          <p className="text-sm font-semibold text-[#f8fafc]">Categorías</p>
          <p className="text-xs text-slate-400">
            {filteredCategories.length}{" "}
            {filteredCategories.length === 1 ? "categoría" : "categorías"}
          </p>
        </div>

        <div className="shrink-0 border-b border-black px-3 py-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="h-9 w-full rounded-lg border border-black bg-surface-inset pl-8 pr-3 text-sm text-[#f8fafc] outline-none placeholder:text-slate-500 focus:border-emerald-600/50"
              placeholder="Buscar categoria"
              value={categoryQuery}
              onChange={(event) => setCategoryQuery(event.target.value)}
            />
          </div>

          {showCategoryCreate ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-black bg-surface-inset p-1">
              <input
                className="h-9 min-w-0 flex-1 rounded-md border-0 bg-transparent px-2 text-sm font-black text-[#f8fafc] outline-none placeholder:text-slate-500"
                placeholder="Nueva categoria"
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    addCategory();
                  }
                }}
              />
              <button
                type="button"
                onClick={addCategory}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-black bg-surface-card text-[#f8fafc] hover:bg-surface-panel"
                title="Agregar categoria"
                aria-label="Agregar categoria"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-3">
          <div className="flex min-w-0 flex-col gap-2.5">
            {filteredCategories.map((currentCategory) => {
              const categorySelected = currentCategory.name === selectedCategory;
              const subs = categorySubcategories(currentCategory);
              const subCount = subs.length;
              const categoryStockItemsResolved = categoryStockItems(currentCategory);
              const editing = editingCategory === currentCategory.name;
              const isAddingSubcategory = openSubcategoryInput === currentCategory.name;

              return (
                <div key={currentCategory.name} className={`min-w-0 ${categoryCardClass(categorySelected)}`}>
                  <div
                    className={categoryHeaderClass(
                      categorySelected && !selectedSubcategoryId,
                      categorySelected && subs.length > 0,
                    )}
                  >
                    <div className="px-3 py-2.5">
                      {editing ? (
                        <input
                          className={`${inputClass} h-9 w-full text-sm`}
                          value={editingCategoryName}
                          onChange={(event) => setEditingCategoryName(event.target.value)}
                          autoFocus
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => selectCategory(currentCategory.name)}
                          className="flex w-full min-w-0 flex-col gap-2 text-left"
                        >
                          <span className="flex items-start gap-2.5">
                            <span
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                                categorySelected
                                  ? accentEmeraldSolid
                                  : "border-black bg-surface-inset text-slate-400"
                              }`}
                            >
                              <Layers3 className="h-3.5 w-3.5" />
                            </span>
                            <span className="min-w-0 flex-1 break-words text-sm font-semibold capitalize leading-snug text-[#f8fafc]">
                              {currentCategory.name}
                            </span>
                          </span>
                          <span className="flex flex-wrap items-center gap-1 pl-[2.875rem]">
                            {subCount > 0 ? (
                              <CountBadge count={subCount} title="subcategorías" />
                            ) : null}
                            <StockBadgeDisplay
                              items={categoryStockItemsResolved}
                              title="Stock en categoría"
                            />
                          </span>
                        </button>
                      )}
                    </div>

                    {categorySelected || editing ? (
                      <div className={rowActionsBarClass}>
                        {editing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => saveCategory(currentCategory.name)}
                              className={addBtnClass}
                              title="Guardar"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCategory("");
                                setEditingCategoryName("");
                              }}
                              className={iconBtnClass}
                              title="Cancelar"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenSubcategoryInput(
                                  isAddingSubcategory ? "" : currentCategory.name,
                                );
                              }}
                              className={iconBtnClass}
                              title="Agregar subcategoría"
                              aria-label="Agregar subcategoría"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCategory(currentCategory.name);
                                setEditingCategoryName(currentCategory.name);
                              }}
                              className={iconBtnClass}
                              title="Editar categoría"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteCategory(currentCategory.name)}
                              className={iconBtnClass}
                              title="Borrar categoría"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {isAddingSubcategory ? (
                    <div className="mx-2 mb-2 flex items-center gap-1.5 rounded-lg border border-dashed border-black bg-surface-inset px-2.5 py-2">
                      <input
                        className={`${inputClass} h-8 min-w-0 flex-1 border-0 bg-transparent text-sm`}
                        placeholder="Subcategoria"
                        value={newNameByKey[currentCategory.name] || ""}
                        onChange={(event) =>
                          setNewNameByKey((current) => ({
                            ...current,
                            [currentCategory.name]: event.target.value,
                          }))
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            addSubcategory(currentCategory.name);
                          }
                        }}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => addSubcategory(currentCategory.name)}
                        className={addBtnClass}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}

                  {categorySelected && subs.length > 0 ? (
                    <div className={subcategoryPanelClass}>
                      <p className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Subcategorías
                      </p>
                      <div className="flex flex-col gap-1.5">
                      {subs.map((subcategory) => {
                        const subSelected = selectedSubcategoryId === subcategory.id;
                        const subEditing = editingSubcategoryId === subcategory.id;
                        const subStockItems = subcategoryStockItems(
                          currentCategory,
                          subcategory.name,
                          (subcategory.children || []).map((child) => child.name),
                        );

                        return (
                          <div key={subcategory.id} className={subcategoryRowClass(subSelected)}>
                            <div className="px-2 py-1.5">
                              {subEditing ? (
                                <input
                                  className={`${inputClass} h-8 w-full text-sm`}
                                  value={editingSubcategoryName}
                                  onChange={(event) =>
                                    setEditingSubcategoryName(event.target.value)
                                  }
                                  autoFocus
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => selectSubcategory(subcategory.id)}
                                  className="flex w-full min-w-0 flex-col gap-1.5 text-left"
                                >
                                  <span className="flex items-start gap-1.5">
                                    <ChevronRight
                                      className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                                        subSelected ? "text-emerald-400" : "text-slate-500"
                                      }`}
                                    />
                                    <span className="min-w-0 flex-1 break-words text-sm font-medium capitalize leading-snug text-slate-200">
                                      {subcategory.name}
                                    </span>
                                  </span>
                                  <span className="pl-5">
                                    <StockBadgeDisplay
                                      items={subStockItems}
                                      title="Stock en subcategoría"
                                    />
                                  </span>
                                </button>
                              )}
                            </div>

                            {subSelected || subEditing ? (
                              <div className={rowActionsBarClass}>
                                {subEditing ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        saveSubcategory(currentCategory.name, subcategory.id)
                                      }
                                      className={addBtnClass}
                                      title="Guardar"
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingSubcategoryId("");
                                        setEditingSubcategoryName("");
                                      }}
                                      className={iconBtnClass}
                                      title="Cancelar"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingSubcategoryId(subcategory.id);
                                        setEditingSubcategoryName(subcategory.name);
                                      }}
                                      className={iconBtnClass}
                                      title="Editar subcategoría"
                                    >
                                      <Edit3 className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        deleteSubcategory(currentCategory.name, subcategory.id)
                                      }
                                      className={iconBtnClass}
                                      title="Borrar subcategoría"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}

            {!filteredCategories.length ? (
              <div className="rounded-xl border border-dashed border-black bg-surface-card px-4 py-10 text-center">
                <p className="text-sm font-black text-slate-300">Sin categorias</p>
                {showCategoryCreate ? (
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    Crea la primera arriba.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    ),
    // Sidebar shell: handlers close over latest state; full deps would rebuild every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional stable shell snapshot
    [
      categoryQuery,
      newCategoryName,
      filteredCategories,
      selectedCategory,
      selectedSubcategoryId,
      editingCategory,
      editingCategoryName,
      editingSubcategoryId,
      editingSubcategoryName,
      openSubcategoryInput,
      newNameByKey,
      showCategoryCreate,
    ],
  );

  useLayoutEffect(() => {
    if (layout !== "sidebar") {
      return;
    }

    setShellConfig({
      compactContent: categorySidebar,
      compactNavLabel: "Inventario",
      compactNavSettingsHref: "/configuracion?view=inventory&from=inventario",
    });

    return () => setShellConfig({});
  }, [categorySidebar, layout, setShellConfig]);

  const panelTitle = selectedSubcategory
    ? `${selectedCategoryData?.name} › ${selectedSubcategory.name}`
    : selectedCategoryData?.name || "Items";

  const itemPlaceholder = selectedSubcategory
    ? "Nombre del item (ej. rojo, aislante)"
    : "Nombre del item (ej. 14x14x14, 16x16x16)";

  const itemsPanel = (
    <Panel
      title={panelTitle}
      className="w-full"
      contentClassName="grid gap-4 p-4 sm:p-5"
      action={
        <span className={`h-9 w-9 ${iconWellEmerald}`}>
          <Box className="h-4 w-4" />
        </span>
      }
    >
      {!selectedCategoryData ? (
        <div className="rounded-lg border border-dashed border-black bg-surface-card px-4 py-10 text-center">
          <p className="font-black text-[#f8fafc]">Selecciona una categoria</p>
          <p className="mt-1 text-sm font-bold text-slate-500">
            Elige una del panel izquierdo.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-300">
              {selectedSubcategory
                ? `${selectedItems.length} items en ${selectedSubcategory.name}`
                : `${selectedItems.length} items en ${selectedCategoryData.name}`}
            </p>
            {showNewItemForm ? (
              <button
                type="button"
                onClick={() => setShowNewItemForm(false)}
                className="text-xs font-semibold text-slate-400 hover:text-slate-200"
              >
                Cancelar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowNewItemForm(true)}
                className={primaryButtonClass}
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar item
              </button>
            )}
          </div>

          {!selectedSubcategory && subcategories.length ? (
            <div className="rounded-lg border border-black bg-surface-card-header px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Subcategorías
              </p>
              <p className="mt-1 text-xs text-slate-300">
                También tienes {subcategories.length} subcategoría
                {subcategories.length === 1 ? "" : "s"}. Elige una en el panel izquierdo o agrega
                items directamente aquí.
              </p>
            </div>
          ) : null}

          {showNewItemForm ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-600/50 bg-surface-card p-3">
              <button
                type="button"
                onClick={() =>
                  addItem(
                    selectedCategoryData.name,
                    selectedSubcategory?.id ?? null,
                  )
                }
                className={addBtnClass}
              >
                <Plus className="h-4 w-4" />
              </button>
              <input
                className={`${inputClass} h-9 min-w-0 flex-1 text-sm`}
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
                    addItem(
                      selectedCategoryData.name,
                      selectedSubcategory?.id ?? null,
                    );
                  }
                }}
                autoFocus
              />
            </div>
          ) : null}

          {selectedItems.length ? (
            <div className={itemsGridClass}>
              {selectedItems.map((item) => renderItemCard(item))}
            </div>
          ) : !showNewItemForm ? (
            <div className="grid gap-3 rounded-lg border border-dashed border-black bg-surface-card px-4 py-10 text-center">
              <p className="font-black text-[#f8fafc]">Sin items todavía</p>
              <p className="text-sm font-medium text-slate-300">
                {selectedSubcategory
                  ? "Agrega variantes como rojo, azul o aislante."
                  : `Agrega medidas o variantes en ${selectedCategoryData.name} (ej. 14x14x14).`}
              </p>
              {!selectedSubcategory ? (
                <p className="text-xs text-slate-400">
                  ¿Necesitas agrupar? Usa el + junto a la categoría para crear una subcategoría
                  (ej. cintas dentro de herramientas).
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </Panel>
  );

  if (layout === "inline") {
    return (
      <div className="grid gap-4 xl:grid-cols-[minmax(280px,320px)_minmax(0,1fr)] xl:items-start">
        {categorySidebar}
        {itemsPanel}
      </div>
    );
  }

  return itemsPanel;
}
