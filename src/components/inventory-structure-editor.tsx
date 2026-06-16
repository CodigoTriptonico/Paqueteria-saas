"use client";

import {
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  Edit3,
  History,
  Layers3,
  Loader2,
  Package2,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { recordInventoryMovementForLeafAction } from "@/app/actions/inventory";
import { useSetShellConfig } from "@/components/app-frame";
import {
  InlineSearchCombobox,
  InlineSearchPicker,
} from "@/components/inline-search-picker";
import { InventoryMovementsSidePanel } from "@/components/inventory-movements-panel";
import { useNotify } from "@/hooks/use-notify";
import {
  accentEmeraldSolid,
  iconWellEmerald,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui-blocks";
import { StockBadgeDisplay } from "@/components/stock-badge";
import {
  inventoryItemsForLeaf,
  leafStockMetrics,
  resolveCategoryStockItems,
  resolveSubcategoryStockItems,
  stockBadgeToneClass,
  stockCardClass,
  stockStatusLabel,
  stockValueToneClass,
  type InventoryStockItem,
} from "@/lib/inventory-stock";
import type { InventoryAssignment, InventoryMovement } from "@/lib/inventory-types";
import {
  addInventoryTreeChild,
  categoryDirectItems,
  categoryItems,
  categorySubcategories,
  deleteInventoryTreeItem,
  inventoryTreeItemExists,
  isInventoryGroup,
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
  warehouseId?: string;
  warehouseName?: string;
  movements?: InventoryMovement[];
  assignments?: InventoryAssignment[];
  onMovementRecorded?: (movement: InventoryMovement) => void;
  onAssignItem?: (context: ItemContextMenu) => void;
  onViewItemAssignments?: (itemId: string) => void;
  layout?: "sidebar" | "inline";
  showCategoryCreate?: boolean;
  embedded?: boolean;
  headerSlot?: React.ReactNode;
  toolbarEndSlot?: React.ReactNode;
  footerSlot?: React.ReactNode;
};

type ItemContextMenu = {
  x: number;
  y: number;
  treeItem: InventoryTreeItem;
  stockItem: InventoryStockItem;
  categoryName: string;
  subcategoryName?: string;
};

type MovementDraft = {
  type: "entrada" | "salida" | "ajuste";
  qty: string;
  note: string;
  context: ItemContextMenu;
};

const itemsGridClass =
  "grid grid-cols-[repeat(auto-fill,minmax(272px,1fr))] gap-3 sm:gap-4";

function formatScopedItemCount(count: number, scope: string) {
  return `${count} ${count === 1 ? "item" : "items"} en ${scope}`;
}

function categoryVisibleLeafItems(category: CategoryConfig): InventoryTreeItem[] {
  const leaves: InventoryTreeItem[] = [];

  for (const item of categoryItems(category)) {
    if (isInventoryGroup(item)) {
      leaves.push(...(item.children || []));
    } else {
      leaves.push(item);
    }
  }

  return leaves;
}

const INVENTORY_CATEGORIES_CONFIG_HREF =
  "/configuracion?view=inventory&inventory=categories";

const STRUCTURE_MENU_WIDTH = 288;

const addBtnClass =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-400 text-slate-950 transition hover:brightness-110";
const iconBtnClass =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-300 transition hover:bg-surface-card-hover hover:text-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-40";
const countBadgeClass =
  "inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md border border-black bg-surface-inset px-1.5 text-[11px] font-semibold tabular-nums text-slate-200";
const categoryCardSelectedClass = "border-black bg-emerald-400/10";
const subcategoryRowSelectedClass = "border-black bg-emerald-400/10";
const categoryCardClass = (active: boolean) =>
  `overflow-hidden rounded-lg border transition ${
    active
      ? categoryCardSelectedClass
      : "border-black bg-surface-card/55 hover:bg-surface-card-hover"
  }`;
const categoryHeaderClass = (selected: boolean, hasSubsBelow: boolean) =>
  `group min-w-0 border-black transition ${
    hasSubsBelow ? "border-b border-black/70" : ""
  } ${selected ? "bg-transparent" : "hover:bg-surface-card-hover"}`;
const rowActionsBarClass = "flex items-center justify-end gap-0.5 px-2 pb-2";
const subcategoryPanelClass =
  "mx-2 mb-2 flex min-w-0 flex-col gap-1.5 border-l border-black/40 pl-2 py-1";
const subcategoryRowClass = (selected: boolean) =>
  `group flex min-w-0 flex-col overflow-hidden rounded-md border transition ${
    selected
      ? subcategoryRowSelectedClass
      : "border-black hover:bg-surface-card-hover"
  }`;

function CountBadge({ count, title }: { count: number; title: string }) {
  return (
    <span
      className={countBadgeClass}
      title={title}
      aria-label={`${count} ${title}`}
    >
      {count}
    </span>
  );
}

function movementsForItem(
  movements: InventoryMovement[],
  stockItem: InventoryStockItem,
  itemName: string,
) {
  const dbItemId = stockItem.id.startsWith("virtual-") ? null : stockItem.id;

  return movements.filter((movement) => {
    if (dbItemId && movement.itemId === dbItemId) {
      return true;
    }

    return movement.itemName === itemName || movement.itemName === stockItem.name;
  });
}

export function InventoryStructureEditor({
  categoryConfigs,
  onCategoryConfigsChange,
  inventoryItems = [],
  onInventoryItemsChange,
  warehouseId,
  warehouseName,
  movements = [],
  assignments = [],
  onMovementRecorded,
  onAssignItem,
  onViewItemAssignments,
  layout = "sidebar",
  showCategoryCreate = false,
  embedded = false,
  headerSlot,
  toolbarEndSlot,
  footerSlot,
}: InventoryStructureEditorProps) {
  const setShellConfig = useSetShellConfig();
  const notify = useNotify();
  const [categoryQuery, setCategoryQuery] = useState("");
  const [itemQuery, setItemQuery] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [structureMenuPosition, setStructureMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [structureMenuMounted, setStructureMenuMounted] = useState(false);
  const structureButtonRef = useRef<HTMLButtonElement>(null);
  const structurePanelRef = useRef<HTMLDivElement>(null);
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
  const [itemContextMenu, setItemContextMenu] =
    useState<ItemContextMenu | null>(null);
  const [itemHistoryContext, setItemHistoryContext] =
    useState<ItemContextMenu | null>(null);
  const [movementDraft, setMovementDraft] = useState<MovementDraft | null>(
    null,
  );
  const [stockSaving, setStockSaving] = useState(false);
  const [stockError, setStockError] = useState("");

  const showStructureOptions = showCategoryCreate;
  const structureEditingEnabled = showStructureOptions && optionsOpen;

  useEffect(() => {
    queueMicrotask(() => {
      if (!categoryConfigs.length && showStructureOptions) {
        setOptionsOpen(true);
      }
    });
  }, [categoryConfigs.length, showStructureOptions]);

  useEffect(() => {
    if (!structureEditingEnabled) {
      queueMicrotask(() => {
        setEditingCategory("");
        setEditingCategoryName("");
        setEditingSubcategoryId("");
        setEditingSubcategoryName("");
        setOpenSubcategoryInput("");
        setShowNewCategoryInput(false);
        setShowNewItemForm(false);
        setEditingItemId("");
        setEditingItemName("");
      });
    }
  }, [structureEditingEnabled]);

  useEffect(() => {
    queueMicrotask(() => {
      setItemQuery("");
    });
  }, [selectedCategory, selectedSubcategoryId]);

  function openStructureOptions(opts?: {
    addCategory?: boolean;
    addItem?: boolean;
  }) {
    setOptionsOpen(true);

    if (opts?.addCategory) {
      setShowNewCategoryInput(true);
    }

    if (opts?.addItem) {
      setShowNewItemForm(true);
    }
  }

  const updateStructureMenuPosition = useCallback(() => {
    const trigger = structureButtonRef.current;

    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const margin = 8;
    const left = Math.min(
      Math.max(margin, rect.right - STRUCTURE_MENU_WIDTH),
      window.innerWidth - STRUCTURE_MENU_WIDTH - margin,
    );

    setStructureMenuPosition({
      top: rect.bottom + 6,
      left,
    });
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      setStructureMenuMounted(true);
    });
  }, []);

  useEffect(() => {
    if (!embedded || !optionsOpen) {
      return;
    }

    updateStructureMenuPosition();

    window.addEventListener("resize", updateStructureMenuPosition);
    window.addEventListener("scroll", updateStructureMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateStructureMenuPosition);
      window.removeEventListener("scroll", updateStructureMenuPosition, true);
    };
  }, [embedded, optionsOpen, updateStructureMenuPosition]);

  useEffect(() => {
    if (!embedded || !optionsOpen) {
      return;
    }

    function handlePointerDown(event: globalThis.MouseEvent) {
      const target = event.target as Node;

      if (
        structureButtonRef.current?.contains(target) ||
        structurePanelRef.current?.contains(target)
      ) {
        return;
      }

      setOptionsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOptionsOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [embedded, optionsOpen]);

  useEffect(() => {
    if (selectedCategory || !categoryConfigs.length) {
      return;
    }

    queueMicrotask(() => {
      setSelectedCategory(categoryConfigs[0].name);
    });
  }, [categoryConfigs, selectedCategory]);

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
      categoryConfigs.find(
        (currentCategory) => currentCategory.name === selectedCategory,
      ) || null,
    [categoryConfigs, selectedCategory],
  );

  const subcategories = useMemo(
    () =>
      selectedCategoryData ? categorySubcategories(selectedCategoryData) : [],
    [selectedCategoryData],
  );

  const selectedSubcategory = useMemo(
    () =>
      subcategories.find((item) => item.id === selectedSubcategoryId) || null,
    [subcategories, selectedSubcategoryId],
  );

  const directItems = useMemo(
    () =>
      selectedCategoryData ? categoryDirectItems(selectedCategoryData) : [],
    [selectedCategoryData],
  );

  const selectedItems = useMemo(() => {
    if (selectedSubcategory) {
      return selectedSubcategory.children || [];
    }

    return directItems;
  }, [selectedSubcategory, directItems]);

  const scopedItems = useMemo(() => {
    if (!selectedCategoryData) {
      return [];
    }

    if (selectedSubcategory) {
      return selectedSubcategory.children || [];
    }

    return categoryVisibleLeafItems(selectedCategoryData);
  }, [selectedCategoryData, selectedSubcategory]);

  const filteredItems = useMemo(() => {
    const query = normalizeInventoryText(itemQuery.trim());

    if (!query) {
      return scopedItems;
    }

    return scopedItems.filter((item) =>
      normalizeInventoryText(item.name).includes(query),
    );
  }, [itemQuery, scopedItems]);

  const optionsSummary = useMemo(() => {
    if (!categoryConfigs.length) {
      return "Agregar categoría o item";
    }

    return `Estructura · ${categoryConfigs.length} categorías`;
  }, [categoryConfigs.length]);

  const itemInputKey = selectedSubcategory
    ? `${selectedCategory}:${selectedSubcategory.id}:item`
    : `${selectedCategory}:direct:item`;

  const itemPlaceholder = selectedSubcategory
    ? "Nombre del item (ej. rojo, aislante)"
    : "Nombre del item (ej. 14x14x14, 16x16x16)";

  function selectCategory(name: string) {
    setSelectedCategory(name);
    setSelectedSubcategoryId("");
    setCategoryQuery("");
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

  const subcategoryStockItems = useCallback(
    (
      category: CategoryConfig,
      subcategoryName: string,
      childKindNames: string[],
    ) => {
      return resolveSubcategoryStockItems(
        inventoryItems,
        category,
        subcategoryName,
        childKindNames,
      );
    },
    [inventoryItems],
  );

  function pushInventoryItem(item: InventoryStockItem) {
    onInventoryItemsChange?.([...inventoryItems, item]);
  }

  function sameStockLeaf(
    item: InventoryStockItem,
    categoryName: string,
    kind: string,
    subcategoryName?: string,
  ) {
    return (
      normalizeInventoryText(item.category) ===
        normalizeInventoryText(categoryName) &&
      normalizeInventoryText(item.kind) === normalizeInventoryText(kind) &&
      normalizeInventoryText(item.subcategory || "") ===
        normalizeInventoryText(subcategoryName || "")
    );
  }

  function upsertInventoryStockItem(nextItem: InventoryStockItem) {
    const exists = inventoryItems.some(
      (item) =>
        item.id === nextItem.id ||
        sameStockLeaf(
          item,
          nextItem.category,
          nextItem.kind,
          nextItem.subcategory,
        ),
    );

    onInventoryItemsChange?.(
      exists
        ? inventoryItems.map((item) =>
            item.id === nextItem.id ||
            sameStockLeaf(
              item,
              nextItem.category,
              nextItem.kind,
              nextItem.subcategory,
            )
              ? { ...item, ...nextItem }
              : item,
          )
        : [...inventoryItems, nextItem],
    );
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

    onInventoryItemsChange?.(
      inventoryItems.filter((item) => !matchIds.has(item.id)),
    );
  }

  function addCategory() {
    const name = newCategoryName.trim();

    if (!name || categoryNames.includes(name)) {
      return;
    }

    onCategoryConfigsChange([...categoryConfigs, { name, items: [] }]);
    selectCategory(name);
    setNewCategoryName("");
    setShowNewCategoryInput(false);
  }

  function saveCategory(oldName: string) {
    const name = editingCategoryName.trim();

    if (!name || (name !== oldName && categoryNames.includes(name))) {
      return;
    }

    onCategoryConfigsChange(
      categoryConfigs.map((currentCategory) =>
        currentCategory.name === oldName
          ? { ...currentCategory, name }
          : currentCategory,
      ),
    );

    onInventoryItemsChange?.(
      inventoryItems.map((item) =>
        normalizeInventoryText(item.category) ===
        normalizeInventoryText(oldName)
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
      categoryConfigs.filter(
        (currentCategory) => currentCategory.name !== name,
      ),
    );

    onInventoryItemsChange?.(
      inventoryItems.filter(
        (item) =>
          normalizeInventoryText(item.category) !==
          normalizeInventoryText(name),
      ),
    );

    if (selectedCategory === name) {
      const next =
        categoryConfigs.find((item) => item.name !== name)?.name || "";
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
          items: updateInventoryTreeItem(
            categoryItems(currentCategory),
            subcategoryId,
            nextName,
          ),
        };
      }),
    );

    if (previousName && previousName !== nextName) {
      onInventoryItemsChange?.(
        inventoryItems.map((item) =>
          normalizeInventoryText(item.category) ===
            normalizeInventoryText(categoryName) &&
          item.subcategory &&
          normalizeInventoryText(item.subcategory) ===
            normalizeInventoryText(previousName)
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
              items: deleteInventoryTreeItem(
                categoryItems(currentCategory),
                subcategoryId,
              ),
            }
          : currentCategory,
      ),
    );

    if (selectedSubcategoryId === subcategoryId) {
      setSelectedSubcategoryId("");
    }
  }

  function addItem() {
    if (!selectedCategoryData) {
      notify.error("Elige una categoría antes de agregar un item.");
      return;
    }

    const categoryName = selectedCategoryData.name;
    const subcategoryId = selectedSubcategory?.id ?? null;
    const inputKey = subcategoryId
      ? `${categoryName}:${subcategoryId}:item`
      : `${categoryName}:direct:item`;
    const itemName = (newNameByKey[inputKey] || "").trim();

    if (!itemName) {
      notify.error("Escribe un nombre para el item.");
      return;
    }

    const siblings = subcategoryId
      ? selectedSubcategory?.children || []
      : categoryDirectItems(selectedCategoryData);

    if (inventoryTreeItemExists(siblings, itemName)) {
      notify.error("Ya existe un item con ese nombre aquí.");
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

    const subcategoryName = subcategoryId ? selectedSubcategory?.name : undefined;

    pushInventoryItem({
      id: `inv-${Date.now()}`,
      name: itemName,
      category: categoryName,
      kind: itemName,
      subcategory: subcategoryName,
      stock: 0,
      reserved: 0,
      assigned: 0,
      unavailable: 0,
      minStock: 2,
    });

    notify.success(
      subcategoryName
        ? `Item agregado en ${categoryName} › ${subcategoryName}`
        : `Item agregado en ${categoryName}`,
    );
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
          items: updateInventoryTreeItem(
            categoryItems(currentCategory),
            itemId,
            nextName,
          ),
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
              items: deleteInventoryTreeItem(
                categoryItems(currentCategory),
                itemId,
              ),
            }
          : currentCategory,
      ),
    );

    if (treeItem) {
      removeInventoryForLeaf(
        categoryName,
        treeItem.name,
        selectedSubcategory?.name,
      );
    }
  }

  function openItemContextMenu(
    event: MouseEvent<HTMLElement>,
    item: InventoryTreeItem,
    stockItem: InventoryStockItem,
  ) {
    if (!selectedCategoryData) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setStockError("");

    const menuWidth = 220;
    const menuHeight = warehouseId ? 320 : 240;
    const x = Math.min(event.clientX, window.innerWidth - menuWidth - 12);
    const y = Math.min(event.clientY, window.innerHeight - menuHeight - 12);

    setItemContextMenu({
      x: Math.max(12, x),
      y: Math.max(12, y),
      treeItem: item,
      stockItem,
      categoryName: selectedCategoryData.name,
      subcategoryName: selectedSubcategory?.name,
    });
  }

  function beginMovement(type: MovementDraft["type"]) {
    if (!itemContextMenu) {
      return;
    }

    setMovementDraft({
      type,
      qty: type === "ajuste" ? String(itemContextMenu.stockItem.stock) : "1",
      note: "",
      context: itemContextMenu,
    });
    setItemContextMenu(null);
    setStockError("");
  }

  function openItemHistory() {
    if (!itemContextMenu || !warehouseId) {
      return;
    }

    setItemHistoryContext(itemContextMenu);
    setItemContextMenu(null);
  }

  async function submitMovement() {
    if (!movementDraft) {
      return;
    }

    if (!warehouseId) {
      setStockError("Bodega no lista");
      return;
    }

    const qty = Number(movementDraft.qty);

    if (
      !Number.isFinite(qty) ||
      qty < 0 ||
      (movementDraft.type !== "ajuste" && qty === 0)
    ) {
      setStockError("Cantidad invalida");
      return;
    }

    setStockSaving(true);
    setStockError("");

    const result = await recordInventoryMovementForLeafAction({
      warehouseId,
      category: movementDraft.context.categoryName,
      kind: movementDraft.context.treeItem.name,
      subcategory: movementDraft.context.subcategoryName,
      itemName: movementDraft.context.treeItem.name,
      type: movementDraft.type,
      qty,
      note: movementDraft.note,
      minStock: movementDraft.context.stockItem.minStock,
    });

    setStockSaving(false);

    if (!result.ok) {
      setStockError(result.error);
      notify.error(result.error);
      return;
    }

    const movementType = movementDraft.type;

    upsertInventoryStockItem(result.data.item);
    onMovementRecorded?.(result.data.movement);
    setMovementDraft(null);

    const movementLabels: Record<MovementDraft["type"], string> = {
      entrada: "Entrada registrada",
      salida: "Salida registrada",
      ajuste: "Ajuste registrado",
    };
    notify.success(movementLabels[movementType]);
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
        onContextMenu={(event) => openItemContextMenu(event, item, stockItem)}
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
          </div>
        ) : null}
      </article>
    );
  }

  const categorySidebar = useMemo(
    () => (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-3 sm:px-4">
        <div className="shrink-0 pb-3">
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
            Categorías
          </p>
          <p className="text-xs font-bold text-slate-400">
            {filteredCategories.length}{" "}
            {filteredCategories.length === 1 ? "activa" : "activas"}
          </p>
        </div>

        <div className="shrink-0 pb-3">
          {categoryConfigs.length ? (
            <InlineSearchCombobox
              value={categoryQuery}
              onChange={setCategoryQuery}
              options={categoryConfigs.map((category) => ({
                value: category.name,
                label: category.name,
              }))}
              placeholder="Buscar categoría"
              emptyLabel="Sin categorías"
              ariaLabel="Buscar categorías"
              leadingIcon={<Search className="h-4 w-4" aria-hidden />}
              className="w-full"
              minWidthClass="w-full min-w-0"
              onSelectOption={(option) => selectCategory(option.label)}
            />
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          <div className="flex min-w-0 flex-col gap-2">
            {filteredCategories.map((currentCategory) => {
              const categorySelected =
                currentCategory.name === selectedCategory;
              const subs = categorySubcategories(currentCategory);
              const subCount = subs.length;
              const categoryStockItemsResolved =
                categoryStockItems(currentCategory);
              const editing = editingCategory === currentCategory.name;
              const isAddingSubcategory =
                openSubcategoryInput === currentCategory.name;

              return (
                <div
                  key={currentCategory.name}
                  className={`min-w-0 ${categoryCardClass(categorySelected)}`}
                >
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
                          onChange={(event) =>
                            setEditingCategoryName(event.target.value)
                          }
                          autoFocus
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => selectCategory(currentCategory.name)}
                          className="flex w-full min-w-0 items-center gap-3 text-left"
                        >
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                              categorySelected
                                ? accentEmeraldSolid
                                : "border-black bg-surface-inset text-slate-400"
                            }`}
                          >
                            <Layers3 className="h-3.5 w-3.5" />
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold capitalize text-[#f8fafc]">
                            {currentCategory.name}
                          </span>
                          <span className="flex shrink-0 items-center gap-1">
                            {subCount > 0 ? (
                              <CountBadge
                                count={subCount}
                                title="subcategorías"
                              />
                            ) : null}
                            <StockBadgeDisplay
                              items={categoryStockItemsResolved}
                              title="Stock en categoría"
                            />
                          </span>
                        </button>
                      )}
                    </div>

                    {structureEditingEnabled && (categorySelected || editing) ? (
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
                                  isAddingSubcategory
                                    ? ""
                                    : currentCategory.name,
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
                              onClick={() =>
                                deleteCategory(currentCategory.name)
                              }
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

                  {structureEditingEnabled && isAddingSubcategory ? (
                    <div className="mx-2 mb-2 flex items-center gap-1.5 rounded-lg border border-black bg-surface-inset px-2.5 py-2">
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
                          const subSelected =
                            selectedSubcategoryId === subcategory.id;
                          const subEditing =
                            editingSubcategoryId === subcategory.id;
                          const subStockItems = subcategoryStockItems(
                            currentCategory,
                            subcategory.name,
                            (subcategory.children || []).map(
                              (child) => child.name,
                            ),
                          );

                          return (
                            <div
                              key={subcategory.id}
                              className={subcategoryRowClass(subSelected)}
                            >
                              <div className="px-2 py-1.5">
                                {subEditing ? (
                                  <input
                                    className={`${inputClass} h-8 w-full text-sm`}
                                    value={editingSubcategoryName}
                                    onChange={(event) =>
                                      setEditingSubcategoryName(
                                        event.target.value,
                                      )
                                    }
                                    autoFocus
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      selectSubcategory(subcategory.id)
                                    }
                                    className="flex w-full min-w-0 flex-col gap-1.5 text-left"
                                  >
                                    <span className="flex items-start gap-1.5">
                                      <ChevronRight
                                        className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                                          subSelected
                                            ? "text-emerald-400"
                                            : "text-slate-500"
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

                              {structureEditingEnabled &&
                              (subSelected || subEditing) ? (
                                <div className={rowActionsBarClass}>
                                  {subEditing ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          saveSubcategory(
                                            currentCategory.name,
                                            subcategory.id,
                                          )
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
                                          setEditingSubcategoryId(
                                            subcategory.id,
                                          );
                                          setEditingSubcategoryName(
                                            subcategory.name,
                                          );
                                        }}
                                        className={iconBtnClass}
                                        title="Editar subcategoría"
                                      >
                                        <Edit3 className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          deleteSubcategory(
                                            currentCategory.name,
                                            subcategory.id,
                                          )
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
              <div className="px-4 py-6 text-center">
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-400 text-slate-950">
                  <Sparkles className="h-5 w-5" />
                </span>
                <p className="mt-2 text-base font-black text-[#f8fafc]">
                  Sin categorias
                </p>
                {showStructureOptions ? (
                  <button
                    type="button"
                    onClick={() => openStructureOptions({ addCategory: true })}
                    className={`${primaryButtonClass} mt-3`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agregar categoría
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {showStructureOptions ? (
          <div className="mt-2 shrink-0 border-t border-black/70 pt-2">
            <div className="overflow-hidden rounded-lg border border-black/60 bg-[#151d1a]">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-2.5 py-2 text-left"
                onClick={() => setOptionsOpen((current) => !current)}
                aria-expanded={optionsOpen}
              >
                <Settings2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1 truncate text-xs font-black text-slate-300">
                  {optionsOpen ? "Opciones de estructura" : optionsSummary}
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition ${
                    optionsOpen ? "rotate-180" : ""
                  }`}
                  aria-hidden
                />
              </button>

              {optionsOpen ? (
                <div className="max-h-52 space-y-2.5 overflow-y-auto border-t border-black/60 px-2.5 py-2.5">
                  {!showNewCategoryInput ? (
                    <button
                      type="button"
                      onClick={() => setShowNewCategoryInput(true)}
                      className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-black bg-surface-card px-2.5 text-xs font-black text-slate-300 hover:bg-surface-card-hover hover:text-[#f8fafc]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Nueva categoría
                    </button>
                  ) : (
                    <div className="flex items-center gap-1 rounded-md border border-black bg-surface-card p-1">
                      <input
                        className="h-8 min-w-0 flex-1 rounded-md border-0 bg-transparent px-2 text-xs font-black text-[#f8fafc] outline-none placeholder:text-slate-500"
                        placeholder="Nueva categoría"
                        value={newCategoryName}
                        onChange={(event) =>
                          setNewCategoryName(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            addCategory();
                          }
                        }}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={addCategory}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-400 text-slate-950 hover:brightness-110"
                        title="Agregar categoría"
                        aria-label="Agregar categoría"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewCategoryInput(false);
                          setNewCategoryName("");
                        }}
                        className={iconBtnClass}
                        title="Cancelar"
                        aria-label="Cancelar"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {!showNewItemForm ? (
                    <button
                      type="button"
                      disabled={!selectedCategoryData}
                      onClick={() => setShowNewItemForm(true)}
                      className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-black bg-surface-card px-2.5 text-xs font-black text-slate-300 hover:bg-surface-card-hover hover:text-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Agregar item
                    </button>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1 rounded-md border border-black bg-surface-card p-1">
                        <button
                          type="button"
                          disabled={!selectedCategoryData}
                          onClick={() => addItem()}
                          className={addBtnClass}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <input
                          className={`${inputClass} h-8 min-w-0 flex-1 border-0 bg-transparent text-xs`}
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
                          className={iconBtnClass}
                          title="Cancelar"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {!selectedCategoryData ? (
                        <p className="text-[11px] font-bold text-slate-500">
                          Elige una categoría para agregar items.
                        </p>
                      ) : null}
                    </div>
                  )}

                  <p className="text-[11px] font-bold leading-snug text-slate-500">
                    La estructura es compartida entre bodegas.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
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
      showNewCategoryInput,
      showStructureOptions,
      optionsOpen,
      optionsSummary,
      selectedCategoryData,
      itemInputKey,
      itemPlaceholder,
      showNewItemForm,
    ],
  );

  const embeddedCategoryOptions = useMemo(
    () =>
      categoryConfigs.map((category) => ({
        value: category.name,
        label: category.name,
        icon: <Layers3 className="h-4 w-4 text-slate-500" aria-hidden />,
        trailing: (
          <StockBadgeDisplay
            items={categoryStockItems(category)}
            title="Stock en categoría"
          />
        ),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stock snapshot
    [categoryConfigs, inventoryItems, warehouseId],
  );

  const embeddedSubcategoryOptions = useMemo(() => {
    if (!selectedCategoryData || !subcategories.length) {
      return [];
    }

    return [
      { value: "", label: "Todas las subcategorías" },
      ...subcategories.map((subcategory) => ({
        value: subcategory.id,
        label: subcategory.name,
        trailing: (
          <StockBadgeDisplay
            items={subcategoryStockItems(
              selectedCategoryData,
              subcategory.name,
              (subcategory.children || []).map((child) => child.name),
            )}
            title="Stock en subcategoría"
          />
        ),
      })),
    ];
  }, [selectedCategoryData, subcategories, subcategoryStockItems]);

  const embeddedItemOptions = useMemo(() => {
    if (!selectedCategoryData) {
      return [];
    }

    return scopedItems.map((item) => {
      const leafItems = inventoryItemsForLeaf(
        inventoryItems,
        selectedCategoryData.name,
        item.name,
        selectedSubcategory?.name,
      );

      return {
        value: item.id,
        label: item.name,
        icon: <Package2 className="h-4 w-4 text-slate-500" aria-hidden />,
        trailing: (
          <StockBadgeDisplay
            items={
              leafItems.length
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
                  ]
            }
            title="Stock disponible"
          />
        ),
      };
    });
  }, [
    inventoryItems,
    scopedItems,
    selectedCategoryData,
    selectedSubcategory,
  ]);

  useEffect(() => {
    if (!itemContextMenu) {
      return;
    }

    function closeMenu() {
      setItemContextMenu(null);
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
    }

    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("keydown", handleKey);

    return () => {
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("keydown", handleKey);
    };
  }, [itemContextMenu]);

  useLayoutEffect(() => {
    if (layout !== "sidebar") {
      return;
    }

    setShellConfig({
      compactContent: null,
      compactNavLabel: undefined,
      compactNavSettingsHref: undefined,
    });

    return () => setShellConfig({});
  }, [layout, setShellConfig]);

  const panelTitle = selectedSubcategory
    ? `${selectedCategoryData?.name} › ${selectedSubcategory.name}`
    : selectedCategoryData?.name || "Items";

  const itemHistoryMovements = useMemo(() => {
    if (!itemHistoryContext) {
      return [];
    }

    return movementsForItem(
      movements,
      itemHistoryContext.stockItem,
      itemHistoryContext.treeItem.name,
    );
  }, [itemHistoryContext, movements]);

  const contextMenuAssignments = useMemo(() => {
    if (!itemContextMenu) {
      return [];
    }

    const { stockItem, treeItem } = itemContextMenu;

    return assignments.filter(
      (row) =>
        row.status === "open" &&
        (row.itemId === stockItem.id ||
          row.itemName === treeItem.name ||
          row.itemName === stockItem.name),
    );
  }, [assignments, itemContextMenu]);

  const stockOverlay = (
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
            onClick={() => beginMovement("entrada")}
            className="mt-1 flex h-9 w-full items-center rounded-md px-2 text-left text-sm font-black text-emerald-200 hover:bg-emerald-400/10"
          >
            Entrada
          </button>
          <button
            type="button"
            onClick={() => beginMovement("salida")}
            className="flex h-9 w-full items-center rounded-md px-2 text-left text-sm font-black text-slate-200 hover:bg-surface-card-hover"
          >
            Salida
          </button>
          <button
            type="button"
            onClick={() => beginMovement("ajuste")}
            className="flex h-9 w-full items-center rounded-md px-2 text-left text-sm font-black text-slate-200 hover:bg-surface-card-hover"
          >
            Ajuste
          </button>
          {warehouseId ? (
            <button
              type="button"
              onClick={openItemHistory}
              className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm font-black text-slate-200 hover:bg-surface-card-hover"
            >
              <History className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              Historial
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
                  setEditingItemId(itemContextMenu.treeItem.id);
                  setEditingItemName(itemContextMenu.treeItem.name);
                  setItemContextMenu(null);
                }}
                className="flex h-9 w-full items-center rounded-md px-2 text-left text-sm font-black text-slate-200 hover:bg-surface-card-hover"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteItem(
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
              void submitMovement();
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
                    current
                      ? { ...current, note: event.target.value }
                      : current,
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
                {stockSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
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

  if (!categoryConfigs.length) {
    return (
      <section className="rounded-xl border border-dashed border-slate-600/60 p-5">
        <div className="mx-auto flex min-h-[22rem] max-w-xl flex-col items-center justify-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-400 text-slate-950">
            <Sparkles className="h-7 w-7" />
          </span>
          <h2 className="mt-4 text-3xl font-black text-[#f8fafc]">
            Inventario
          </h2>
          <p className="mt-1 text-sm font-bold text-slate-400">
            Crea una categoría para empezar.
          </p>

          {showStructureOptions ? (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => openStructureOptions({ addCategory: true })}
                className={primaryButtonClass}
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar categoría
              </button>
              {!embedded ? (
                <Link
                  href={INVENTORY_CATEGORIES_CONFIG_HREF}
                  className={secondaryButtonClass}
                >
                  Ir a configuración
                </Link>
              ) : null}
            </div>
          ) : (
            <Link
              href={INVENTORY_CATEGORIES_CONFIG_HREF}
              className={`${primaryButtonClass} mt-5`}
            >
              Configurar categorías
            </Link>
          )}

          {showStructureOptions && optionsOpen ? (
            <div className="mt-5 flex w-full max-w-md items-center gap-2 rounded-xl bg-[#111827] p-2">
              <input
                className="h-10 min-w-0 flex-1 bg-transparent px-2 text-sm font-black text-[#f8fafc] outline-none placeholder:text-slate-500"
                placeholder="Nueva categoría"
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    addCategory();
                  }
                }}
                autoFocus
              />
              <button
                type="button"
                onClick={addCategory}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-400 text-slate-950 hover:brightness-110"
                title="Agregar categoría"
                aria-label="Agregar categoría"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  const itemQueryTrimmed = itemQuery.trim();
  const itemQueryActive = itemQueryTrimmed.length > 0;
  const itemCountLabel = selectedSubcategory
    ? formatScopedItemCount(scopedItems.length, selectedSubcategory.name)
    : formatScopedItemCount(
        scopedItems.length,
        selectedCategoryData?.name ?? "",
      );

  const itemSearchPlaceholder = selectedCategoryData
    ? `Buscar en ${selectedCategoryData.name}…`
    : "Buscar item…";

  const itemsPanel = (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      {!embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/70 px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-black capitalize text-[#f8fafc]">
              {panelTitle}
            </p>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {selectedCategoryData ? "Stock y variantes" : "Elige una categoría"}
            </p>
          </div>
          {selectedCategoryData ? (
            <InlineSearchCombobox
              value={itemQuery}
              onChange={setItemQuery}
              options={embeddedItemOptions.length ? embeddedItemOptions : scopedItems.map((item) => ({
                value: item.id,
                label: item.name,
              }))}
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
                También tienes {subcategories.length} subcategoría
                {subcategories.length === 1 ? "" : "s"}. Elige una en el desplegable
                o busca items en toda la categoría.
              </p>
            </div>
          ) : null}

          {filteredItems.length ? (
            <div className={itemsGridClass}>
              {filteredItems.map((item) => renderItemCard(item))}
            </div>
          ) : itemQueryActive ? (
            <div className="grid gap-3 py-12 text-center">
              <p className="text-lg font-black text-[#f8fafc]">
                Sin coincidencias
              </p>
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
              <p className="text-lg font-black text-[#f8fafc]">
                Sin items todavía
              </p>
              <p className="text-sm font-bold text-slate-300">
                {selectedSubcategory
                  ? "Agrega variantes como rojo, azul o aislante."
                  : `Agrega medidas o variantes en ${selectedCategoryData.name} (ej. 14x14x14).`}
              </p>
              {showStructureOptions ? (
                <button
                  type="button"
                  onClick={() => openStructureOptions({ addItem: true })}
                  className={`${primaryButtonClass} mx-auto`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar item
                </button>
              ) : null}
              {!selectedSubcategory && showStructureOptions ? (
                <p className="text-xs text-slate-400">
                  ¿Necesitas agrupar? Abre Opciones y usa + junto a la
                  categoría para crear una subcategoría.
                </p>
              ) : null}
            </div>
          )}
        </div>
      )}
      </div>
    </section>
  );

  if (layout === "inline") {
    return (
      <>
        <div className="space-y-4">
          <div className="border-b border-white/10 pb-3">
            <p className="text-2xl font-black text-[#f8fafc]">Inventario</p>
            <p className="text-sm font-bold text-slate-400">
              Categorias, items y stock en una sola vista.
            </p>
          </div>
          <div className="grid gap-6 xl:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] xl:items-start">
            {categorySidebar}
            {itemsPanel}
          </div>
        </div>
        {stockOverlay}
      </>
    );
  }

  const sidebarLayout = embedded ? (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-black bg-[#25302c] shadow-[0_10px_26px_rgba(0,0,0,0.22)]">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-black/70 bg-[#1a2320] px-4 py-2.5">
        {headerSlot}
        {categoryConfigs.length ? (
          <InlineSearchPicker
            value={selectedCategory}
            onChange={selectCategory}
            placeholder="Elegir categoría"
            searchPlaceholder="Buscar categoría…"
            emptyLabel="Sin categorías"
            ariaLabel="Categoría de inventario"
            leadingIcon={<Layers3 className="h-4 w-4" aria-hidden />}
            options={embeddedCategoryOptions}
            minWidthClass="min-w-[10rem] sm:min-w-[12rem]"
          />
        ) : null}
        {embeddedSubcategoryOptions.length ? (
          <InlineSearchPicker
            value={selectedSubcategoryId}
            onChange={(nextId) => {
              if (!nextId) {
                setSelectedSubcategoryId("");
                return;
              }

              selectSubcategory(nextId);
            }}
            placeholder="Subcategoría"
            searchPlaceholder="Buscar subcategoría…"
            emptyLabel="Sin coincidencias"
            ariaLabel="Subcategoría"
            leadingIcon={<Layers3 className="h-4 w-4" aria-hidden />}
            options={embeddedSubcategoryOptions}
            minWidthClass="min-w-[10rem] sm:min-w-[12rem]"
          />
        ) : null}
        {selectedCategoryData ? (
          <InlineSearchCombobox
            value={itemQuery}
            onChange={setItemQuery}
            placeholder={itemSearchPlaceholder}
            emptyLabel="Sin items"
            ariaLabel="Buscar items"
            leadingIcon={<Search className="h-4 w-4" aria-hidden />}
            options={embeddedItemOptions}
            className="min-w-[11rem] flex-1 basis-[11rem] sm:max-w-md"
          />
        ) : null}
        {toolbarEndSlot || showStructureOptions ? (
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {toolbarEndSlot}
            {showStructureOptions ? (
              <button
                ref={structureButtonRef}
                type="button"
                onClick={() => setOptionsOpen((current) => !current)}
                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition ${
                  optionsOpen
                    ? "border-emerald-500/60 bg-emerald-400/15 text-emerald-200"
                    : "border-black bg-[#111827] text-slate-400 hover:text-slate-200"
                }`}
                aria-expanded={optionsOpen}
                aria-haspopup="menu"
                title="Opciones de estructura"
                aria-label="Opciones de estructura"
              >
                <Settings2 className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{itemsPanel}</div>

      {footerSlot ? (
        <div className="shrink-0 border-t border-black/70 bg-[#1a2320]">
          {footerSlot}
        </div>
      ) : null}
    </section>
  ) : (
    <div className="grid gap-6 xl:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] xl:items-start">
      {categorySidebar}
      {itemsPanel}
    </div>
  );

  return (
    <>
      {sidebarLayout}
      {stockOverlay}
      {embedded &&
      showStructureOptions &&
      optionsOpen &&
      structureMenuPosition &&
      structureMenuMounted
        ? createPortal(
            <div
              ref={structurePanelRef}
              role="menu"
              className="fixed z-[120] flex max-h-[min(24rem,calc(100dvh-5rem))] flex-col gap-2 overflow-y-auto rounded-lg border border-black bg-[#101820] p-3 shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
              style={{
                top: structureMenuPosition.top,
                left: structureMenuPosition.left,
                width: STRUCTURE_MENU_WIDTH,
              }}
            >
              <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-500">
                Estructura
              </p>
              {showNewCategoryInput ? (
                <div className="flex items-center gap-2 rounded-lg border border-black bg-[#111827] p-2">
                  <input
                    className="h-9 min-w-0 flex-1 bg-transparent px-2 text-sm font-black text-[#f8fafc] outline-none placeholder:text-slate-500"
                    placeholder="Nueva categoría"
                    value={newCategoryName}
                    onChange={(event) => setNewCategoryName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        addCategory();
                      }
                    }}
                    autoFocus
                  />
                  <button type="button" onClick={addCategory} className={addBtnClass}>
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewCategoryInput(false);
                      setNewCategoryName("");
                    }}
                    className={iconBtnClass}
                    title="Cancelar"
                    aria-label="Cancelar"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowNewCategoryInput(true)}
                  className={`${secondaryButtonClass} h-9 w-full text-xs`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nueva categoría
                </button>
              )}

              {!showNewItemForm ? (
                <button
                  type="button"
                  disabled={!selectedCategoryData}
                  onClick={() => setShowNewItemForm(true)}
                  className={`${secondaryButtonClass} h-9 w-full text-xs disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nuevo item
                </button>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 rounded-lg border border-black bg-[#111827] p-2">
                    <button
                      type="button"
                      disabled={!selectedCategoryData}
                      onClick={() => addItem()}
                      className={addBtnClass}
                      title="Agregar item"
                      aria-label="Agregar item"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <input
                      className="h-9 min-w-0 flex-1 bg-transparent px-2 text-sm font-black text-[#f8fafc] outline-none placeholder:text-slate-500"
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
                      className={iconBtnClass}
                      title="Cancelar"
                      aria-label="Cancelar"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {!selectedCategoryData ? (
                    <p className="text-[11px] font-bold text-slate-500">
                      Elige una categoría para agregar items.
                    </p>
                  ) : (
                    <p className="text-[11px] font-bold text-slate-500">
                      En{" "}
                      {selectedSubcategory
                        ? `${selectedCategoryData.name} › ${selectedSubcategory.name}`
                        : selectedCategoryData.name}
                    </p>
                  )}
                </div>
              )}

              <p className="text-[11px] font-bold leading-snug text-slate-500">
                La estructura es compartida entre bodegas.
              </p>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
