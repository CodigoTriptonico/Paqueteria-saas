"use client";

import {
  Check,
  Layers3,
  MoreHorizontal,
  Package2,
  Plus,
  Search,
  Settings2,
  Sparkles,
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
import {
  clearInventoryItemPhotoAction,
  recordInventoryMovementForLeafAction,
  updateInventoryItemUnitAction,
  uploadInventoryItemPhotoAction,
} from "@/app/actions/inventory";
import { useSetShellConfig } from "@/components/app-frame";
import {
  InlineSearchCombobox,
  InlineSearchPicker,
} from "@/components/inline-search-picker";
import { InventoryCategorySidebar } from "@/components/inventory/inventory-category-sidebar";
import { InventoryItemContextMenu } from "@/components/inventory/inventory-item-context-menu";
import { InventoryItemGrid } from "@/components/inventory/inventory-item-grid";
import {
  inventoryToolbarFiltersClass,
  inventoryToolbarGroupClass,
  InventoryToolbarIconButton,
} from "@/components/inventory/inventory-toolbar-icon-button";
import { InventoryNewItemPopover } from "@/components/inventory/inventory-new-item-popover";
import { InventoryStructureOptionsMenu } from "@/components/inventory/inventory-structure-options-menu";
import { usePageViewLayout } from "@/components/ui/ui-surface-preferences-provider";
import { useNotify } from "@/hooks/use-notify";
import { ONBOARDING_TARGETS } from "@/lib/onboarding/coach-targets";
import {
  addBtnClass,
  categoryLeafEntries,
  formatScopedItemCount,
  iconBtnClass,
  INVENTORY_HREF,
  movementsForItem,
  sameStockLeaf,
  STRUCTURE_MENU_WIDTH,
  type CategoryLeafEntry,
  type ItemContextMenu,
  type MovementDraft,
} from "@/lib/inventory-structure-utils";
import {
  primaryButtonClass,
} from "@/components/ui-blocks";
import { StockBadgeDisplay } from "@/components/stock-badge";
import {
  collectCategoryTreeLeaves,
  countInventoryArticles,
  inventoryItemsForLeaf,
  inventoryLeafKey,
  resolveCategoryStockItems,
  resolveSubcategoryStockItems,
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
  onManageProductCountries?: (context: ItemContextMenu) => void;
  onViewItemAssignments?: (itemId: string) => void;
  layout?: "sidebar" | "inline";
  showCategoryCreate?: boolean;
  showStructureDelete?: boolean;
  embedded?: boolean;
  headerSlot?: React.ReactNode;
  toolbarEndSlot?: React.ReactNode;
  footerSlot?: React.ReactNode;
  truckQty?: number;
  truckTabOpen?: boolean;
  onTruckTabChange?: (open: boolean) => void;
  truckPanel?: React.ReactNode;
  pricingReturnHref?: string | null;
  pricingReturnLabel?: string | null;
};

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
  onManageProductCountries,
  onViewItemAssignments,
  layout = "sidebar",
  showCategoryCreate = false,
  showStructureDelete = false,
  embedded = false,
  headerSlot,
  toolbarEndSlot,
  footerSlot,
  truckQty = 0,
  truckTabOpen = false,
  onTruckTabChange,
  truckPanel,
  pricingReturnHref,
  pricingReturnLabel,
}: InventoryStructureEditorProps) {
  const setShellConfig = useSetShellConfig();
  const notify = useNotify();
  const { layout: viewLayout } = usePageViewLayout("inventory.items");
  const [categoryQuery, setCategoryQuery] = useState("");
  const [itemQuery, setItemQuery] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [toolbarMenuOpen, setToolbarMenuOpen] = useState(false);
  const [structureMenuMode, setStructureMenuMode] = useState<"create" | "manage">(
    "create",
  );
  const [structureMenuPosition, setStructureMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [structureMenuMounted, setStructureMenuMounted] = useState(false);
  const structureButtonRef = useRef<HTMLButtonElement>(null);
  const toolbarMenuButtonRef = useRef<HTMLButtonElement>(null);
  const toolbarMenuRef = useRef<HTMLDivElement>(null);
  const newItemButtonRef = useRef<HTMLButtonElement>(null);
  const structurePanelRef = useRef<HTMLDivElement>(null);
  const newItemPopoverRef = useRef<HTMLDivElement>(null);
  const [newItemPopoverPosition, setNewItemPopoverPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const emptyCategoryFormRef = useRef<HTMLDivElement>(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState("");
  const [newNameByKey, setNewNameByKey] = useState<Record<string, string>>({});
  const [openSubcategoryInput, setOpenSubcategoryInput] = useState("");
  const [editingCategory, setEditingCategory] = useState("");
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [editingSubcategoryId, setEditingSubcategoryId] = useState("");
  const [editingSubcategoryName, setEditingSubcategoryName] = useState("");
  const [editingItemId, setEditingItemId] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [unitSaving, setUnitSaving] = useState(false);
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
  // Las acciones de una categoría seleccionada no deben depender de que el
  // menú de creación esté visible: editar o borrar tiene que estar siempre
  // disponible desde el engrane de la propia categoría.
  const structureEditingEnabled = optionsOpen;

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
        if (categoryConfigs.length > 0) {
          setShowNewCategoryInput(false);
        }
        setEditingItemId("");
        setEditingItemName("");
      });
    }
  }, [categoryConfigs.length, structureEditingEnabled]);

  useEffect(() => {
    queueMicrotask(() => {
      setItemQuery("");
    });
  }, [selectedCategory, selectedSubcategoryId]);

  function openStructureOptions(opts?: {
    addCategory?: boolean;
    addItem?: boolean;
  }) {
    setStructureMenuMode("create");
    setOptionsOpen(true);

    if (opts?.addCategory) {
      setShowNewCategoryInput(true);
      setShowNewItemForm(false);
    }

    if (opts?.addItem) {
      setShowNewItemForm(true);
      setShowNewCategoryInput(false);
    }
  }

  function beginAddItem() {
    setShowNewCategoryInput(false);
    setOpenSubcategoryInput("");
    setShowNewItemForm(true);
    setOptionsOpen(false);
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

  const updateNewItemPopoverPosition = useCallback(() => {
    const trigger = newItemButtonRef.current;

    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const margin = 8;
    const left = Math.min(
      Math.max(margin, rect.right - STRUCTURE_MENU_WIDTH),
      window.innerWidth - STRUCTURE_MENU_WIDTH - margin,
    );

    setNewItemPopoverPosition({
      top: rect.bottom + 6,
      left,
    });
  }, []);

  useEffect(() => {
    if (!showNewItemForm) {
      return;
    }

    updateNewItemPopoverPosition();

    window.addEventListener("resize", updateNewItemPopoverPosition);
    window.addEventListener("scroll", updateNewItemPopoverPosition, true);

    return () => {
      window.removeEventListener("resize", updateNewItemPopoverPosition);
      window.removeEventListener("scroll", updateNewItemPopoverPosition, true);
    };
  }, [showNewItemForm, updateNewItemPopoverPosition]);

  useEffect(() => {
    if (!embedded || !optionsOpen) {
      return;
    }

    function handlePointerDown(event: globalThis.MouseEvent) {
      const target = event.target as Node;

      if (
        structureButtonRef.current?.contains(target) ||
        newItemButtonRef.current?.contains(target) ||
        structurePanelRef.current?.contains(target) ||
        newItemPopoverRef.current?.contains(target) ||
        emptyCategoryFormRef.current?.contains(target)
      ) {
        return;
      }

      if (!categoryConfigs.length) {
        return;
      }

      setOptionsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (!categoryConfigs.length && showNewCategoryInput) {
          setShowNewCategoryInput(false);
          return;
        }

        setOptionsOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [categoryConfigs.length, embedded, optionsOpen, showNewCategoryInput]);

  useEffect(() => {
    if (!toolbarMenuOpen) {
      return;
    }

    function closeToolbarMenu(event: globalThis.MouseEvent) {
      const target = event.target as Node;

      if (
        toolbarMenuRef.current?.contains(target) ||
        toolbarMenuButtonRef.current?.contains(target)
      ) {
        return;
      }

      setToolbarMenuOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setToolbarMenuOpen(false);
      }
    }

    window.addEventListener("mousedown", closeToolbarMenu);
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("mousedown", closeToolbarMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [toolbarMenuOpen]);

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

  function beginAddSubcategory() {
    if (!selectedCategoryData) {
      notify.error("Elige una categoría primero.");
      return;
    }

    setShowNewCategoryInput(false);
    setShowNewItemForm(false);
    setOpenSubcategoryInput(selectedCategory);
    setStructureMenuMode("create");
    setOptionsOpen(true);
  }

  function beginAddCategory() {
    setShowNewItemForm(false);
    setOpenSubcategoryInput("");
    setShowNewCategoryInput(true);
    setStructureMenuMode("create");
    setOptionsOpen(true);
  }

  function openStructureMenu(
    trigger: HTMLButtonElement,
    mode: "create" | "manage",
  ) {
    structureButtonRef.current = trigger;
    setStructureMenuMode(mode);
    setOptionsOpen(true);
  }

  const addingSubcategoryForSelectedCategory = Boolean(
    selectedCategoryData && openSubcategoryInput === selectedCategory,
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

    return directItems;
  }, [selectedCategoryData, selectedSubcategory, directItems]);

  const filteredItems = useMemo(() => {
    const query = normalizeInventoryText(itemQuery.trim());

    if (!selectedCategoryData) {
      return [];
    }

    const baseItems = selectedSubcategory
      ? scopedItems
      : query
        ? categoryLeafEntries(selectedCategoryData).map((entry) => entry.item)
        : scopedItems;

    if (!query) {
      return baseItems;
    }

    const matchingIds = new Set(
      categoryLeafEntries(selectedCategoryData)
        .filter((entry) => normalizeInventoryText(entry.item.name).includes(query))
        .map((entry) => entry.item.id),
    );

    return baseItems.filter((item) => matchingIds.has(item.id));
  }, [itemQuery, scopedItems, selectedCategoryData, selectedSubcategory]);

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
    ? "Ej. rojo, aislante"
    : "Ej. 14x14x14";

  function renderSubcategoryForm(compact = false) {
    if (!selectedCategoryData || openSubcategoryInput !== selectedCategory) {
      return null;
    }

    const fieldClass = compact
      ? "h-9 min-w-0 flex-1 bg-transparent px-2 text-xs font-black text-[#f8fafc] outline-none placeholder:text-slate-500"
      : "h-10 min-w-0 flex-1 bg-transparent px-2 text-sm font-black text-[#f8fafc] outline-none placeholder:text-slate-500";

    return (
      <div
        className={`inset-shell flex min-w-[12rem] flex-1 items-center gap-1.5 rounded-lg border border-black bg-[#111827] p-1.5 ${
          compact ? "sm:max-w-xs" : "max-w-md"
        }`}
      >
        <input
          className={fieldClass}
          placeholder="Subcategoría (ej. colores)"
          value={newNameByKey[selectedCategory] || ""}
          onChange={(event) =>
            setNewNameByKey((current) => ({
              ...current,
              [selectedCategory]: event.target.value,
            }))
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              addSubcategory(selectedCategory);
            }
          }}
          autoFocus
        />
        <button
          type="button"
          onClick={() => addSubcategory(selectedCategory)}
          className={addBtnClass}
          title="Crear subcategoría"
          aria-label="Crear subcategoría"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            setOpenSubcategoryInput("");
            setNewNameByKey((current) => ({ ...current, [selectedCategory]: "" }));
          }}
          className={iconBtnClass}
          title="Cancelar"
          aria-label="Cancelar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

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

  function exitSubcategory() {
    setSelectedSubcategoryId("");
    setItemQuery("");
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

  function updateLeafPhoto(
    context: ItemContextMenu,
    photoUrl: string | undefined,
  ) {
    onInventoryItemsChange?.(
      inventoryItems.map((item) => {
        const leafMatches = inventoryItemsForLeaf(
          inventoryItems,
          context.categoryName,
          context.treeItem.name,
          context.subcategoryName,
        ).some((match) => match.id === item.id);

        if (!leafMatches) {
          return item;
        }

        return {
          ...item,
          photoUrl,
        };
      }),
    );
  }

  async function handleUploadItemPhoto(context: ItemContextMenu, file: File) {
    setPhotoUploading(true);

    try {
      const formData = new FormData();
      formData.set("photo", file);
      formData.set("itemId", context.stockItem.id);

      const result = await uploadInventoryItemPhotoAction(formData);

      if (!result.ok) {
        notify.error(result.error);
        return;
      }

      updateLeafPhoto(context, result.data.previewUrl);
      notify.success("Foto del producto actualizada");
      setItemContextMenu(null);
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handleClearItemPhoto(context: ItemContextMenu) {
    setPhotoUploading(true);

    try {
      const result = await clearInventoryItemPhotoAction(context.stockItem.id);

      if (!result.ok) {
        notify.error(result.error);
        return;
      }

      updateLeafPhoto(context, undefined);
      notify.success("Foto del producto eliminada");
      setItemContextMenu(null);
    } finally {
      setPhotoUploading(false);
    }
  }

  function updateLeafUnit(context: ItemContextMenu, unit: string) {
    onInventoryItemsChange?.(
      inventoryItems.map((item) => {
        const leafMatches = inventoryItemsForLeaf(
          inventoryItems,
          context.categoryName,
          context.treeItem.name,
          context.subcategoryName,
        ).some((match) => match.id === item.id);

        if (!leafMatches) {
          return item;
        }

        return {
          ...item,
          unit,
        };
      }),
    );
  }

  async function handleUpdateItemUnit(context: ItemContextMenu, unit: string) {
    setUnitSaving(true);

    try {
      const result = await updateInventoryItemUnitAction({
        itemId: context.stockItem.id,
        unit,
        warehouseId,
        category: context.categoryName,
        kind: context.treeItem.name,
        subcategory: context.subcategoryName,
        itemName: context.treeItem.name,
      });

      if (!result.ok) {
        notify.error(result.error);
        return false;
      }

      updateLeafUnit(context, result.data.unit);
      notify.success("Unidad de medida actualizada");
      return true;
    } finally {
      setUnitSaving(false);
    }
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

  const categorySidebar = useMemo(
    () => (
      <InventoryCategorySidebar
        categoryQuery={categoryQuery}
        setCategoryQuery={setCategoryQuery}
        categoryConfigs={categoryConfigs}
        filteredCategories={filteredCategories}
        selectedCategory={selectedCategory}
        selectedSubcategoryId={selectedSubcategoryId}
        editingCategory={editingCategory}
        editingCategoryName={editingCategoryName}
        setEditingCategoryName={setEditingCategoryName}
        setEditingCategory={setEditingCategory}
        openSubcategoryInput={openSubcategoryInput}
        setOpenSubcategoryInput={setOpenSubcategoryInput}
        newNameByKey={newNameByKey}
        setNewNameByKey={setNewNameByKey}
        editingSubcategoryId={editingSubcategoryId}
        editingSubcategoryName={editingSubcategoryName}
        setEditingSubcategoryName={setEditingSubcategoryName}
        setEditingSubcategoryId={setEditingSubcategoryId}
        showStructureOptions={showStructureOptions}
        structureEditingEnabled={structureEditingEnabled}
        optionsOpen={optionsOpen}
        setOptionsOpen={setOptionsOpen}
        optionsSummary={optionsSummary}
        showNewCategoryInput={showNewCategoryInput}
        setShowNewCategoryInput={setShowNewCategoryInput}
        newCategoryName={newCategoryName}
        setNewCategoryName={setNewCategoryName}
        showNewItemForm={showNewItemForm}
        setShowNewItemForm={setShowNewItemForm}
        selectedCategoryData={selectedCategoryData}
        itemInputKey={itemInputKey}
        itemPlaceholder={itemPlaceholder}
        addingSubcategoryForSelectedCategory={addingSubcategoryForSelectedCategory}
        inventoryItems={inventoryItems}
        selectCategory={selectCategory}
        selectSubcategory={selectSubcategory}
        saveCategory={saveCategory}
        deleteCategory={deleteCategory}
        addSubcategory={addSubcategory}
        saveSubcategory={saveSubcategory}
        deleteSubcategory={deleteSubcategory}
        addCategory={addCategory}
        addItem={addItem}
        beginAddItem={beginAddItem}
        beginAddSubcategory={beginAddSubcategory}
        openStructureOptions={openStructureOptions}
        subcategoryStockItems={subcategoryStockItems}
        renderSubcategoryForm={renderSubcategoryForm}
        showStructureDelete={showStructureDelete}
        selectedSubcategory={selectedSubcategory}
      />
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
      { value: "", label: "Items sueltos" },
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

    const entries: CategoryLeafEntry[] = selectedSubcategory
      ? (selectedSubcategory.children || []).map((item) => ({
          item,
          subcategoryName: selectedSubcategory.name,
        }))
      : categoryLeafEntries(selectedCategoryData);

    return entries.map((entry) => {
      const leafItems = inventoryItemsForLeaf(
        inventoryItems,
        selectedCategoryData.name,
        entry.item.name,
        entry.subcategoryName,
      );

      return {
        value: entry.item.id,
        label: entry.subcategoryName
          ? `${entry.item.name} · ${entry.subcategoryName}`
          : entry.item.name,
        icon: <Package2 className="h-4 w-4 text-slate-500" aria-hidden />,
        trailing: (
          <StockBadgeDisplay
            items={
              leafItems.length
                ? leafItems
                : [
                    {
                      id: `virtual-leaf-${entry.item.id}`,
                      name: entry.item.name,
                      category: selectedCategoryData.name,
                      kind: entry.item.name,
                      subcategory: entry.subcategoryName,
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
  }, [inventoryItems, selectedCategoryData, selectedSubcategory]);

  useLayoutEffect(() => {
    if (layout !== "sidebar" || embedded) {
      return;
    }

    setShellConfig({
      compactContent: null,
      compactNavLabel: undefined,
      compactNavSettingsHref: undefined,
    });

    return () =>
      setShellConfig({
        compactContent: undefined,
        compactNavLabel: undefined,
        compactNavSettingsHref: undefined,
      });
  }, [embedded, layout, setShellConfig]);

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

  const inventoryItemsInTree = useMemo(() => {
    const treeKeys = new Set(
      categoryConfigs.flatMap((category) =>
        collectCategoryTreeLeaves(category).map((leaf) => inventoryLeafKey(leaf)),
      ),
    );

    return inventoryItems.filter((item) => treeKeys.has(inventoryLeafKey(item)));
  }, [categoryConfigs, inventoryItems]);

  const inventoryOverview = useMemo(() => {
    const activeAssignments = assignments.filter((row) => row.status === "open");

    return {
      itemCount: countInventoryArticles(categoryConfigs),
      warehouseQty: inventoryItemsInTree.reduce((total, item) => total + item.stock, 0),
      assignedQty: inventoryItemsInTree.reduce(
        (total, item) => total + (item.assigned || 0),
        0,
      ),
      attentionCount: inventoryItemsInTree.filter(
        (item) => item.stock <= Math.max(item.minStock, 0),
      ).length,
      activeAssignments: activeAssignments.length,
    };
  }, [assignments, categoryConfigs, inventoryItemsInTree]);

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
    <InventoryItemContextMenu
      itemContextMenu={itemContextMenu}
      setItemContextMenu={setItemContextMenu}
      movementDraft={movementDraft}
      setMovementDraft={setMovementDraft}
      stockError={stockError}
      stockSaving={stockSaving}
      warehouseId={warehouseId}
      warehouseName={warehouseName}
      structureMenuActionsEnabled={showStructureOptions}
      contextMenuAssignments={contextMenuAssignments}
      itemHistoryContext={itemHistoryContext}
      setItemHistoryContext={setItemHistoryContext}
      itemHistoryMovements={itemHistoryMovements}
      structureMenuMounted={structureMenuMounted}
      assignments={assignments}
      onManageProductCountries={onManageProductCountries}
      onAssignItem={onAssignItem}
      onViewItemAssignments={onViewItemAssignments}
      onBeginMovement={beginMovement}
      onOpenItemHistory={openItemHistory}
      onSubmitMovement={submitMovement}
      onDeleteItem={deleteItem}
      onBeginEditItem={(itemId, itemName) => {
        setEditingItemId(itemId);
        setEditingItemName(itemName);
      }}
      onUploadItemPhoto={handleUploadItemPhoto}
      onClearItemPhoto={handleClearItemPhoto}
      photoUploading={photoUploading}
      onUpdateItemUnit={handleUpdateItemUnit}
      unitSaving={unitSaving}
    />
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
                data-onboarding-target={ONBOARDING_TARGETS.INVENTORY_ADD_CATEGORY}
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar categoría
              </button>
            </div>
          ) : (
            <Link href={INVENTORY_HREF} className={`${primaryButtonClass} mt-5`}>
              Ir a inventario
            </Link>
          )}

          {showStructureOptions && showNewCategoryInput ? (
            <div
              ref={emptyCategoryFormRef}
              className="inset-shell mt-5 flex w-full max-w-md items-center gap-2 rounded-xl bg-[#111827] p-2"
            >
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
              <button
                type="button"
                onClick={() => {
                  setShowNewCategoryInput(false);
                  setNewCategoryName("");
                }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-surface-card-hover hover:text-[#f8fafc]"
                title="Cancelar"
                aria-label="Cancelar"
              >
                <X className="h-5 w-5" />
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
    : formatScopedItemCount(directItems.length, selectedCategoryData?.name ?? "");

  const itemSearchPlaceholder = "Buscar…";

  const itemsPanel = (
    <InventoryItemGrid
      embedded={embedded}
      selectedCategoryData={selectedCategoryData}
      selectedSubcategory={selectedSubcategory}
      panelTitle={panelTitle}
      itemQuery={itemQuery}
      setItemQuery={setItemQuery}
      embeddedItemOptions={embeddedItemOptions}
      scopedItems={scopedItems}
      filteredItems={filteredItems}
      itemQueryTrimmed={itemQueryTrimmed}
      itemQueryActive={itemQueryActive}
      itemCountLabel={itemCountLabel}
      inventoryItems={inventoryItems}
      editingItemId={editingItemId}
      editingItemName={editingItemName}
      setEditingItemName={setEditingItemName}
      setEditingItemId={setEditingItemId}
      showStructureOptions={showStructureOptions}
      showNewItemForm={showNewItemForm}
      addingSubcategoryForSelectedCategory={addingSubcategoryForSelectedCategory}
      exitSubcategory={exitSubcategory}
      beginAddItem={beginAddItem}
      beginAddSubcategory={beginAddSubcategory}
      beginAddCategory={beginAddCategory}
      onItemContextMenu={openItemContextMenu}
      onSaveItem={saveItem}
      viewLayout={viewLayout}
    />
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
      <div className="flex shrink-0 items-center gap-2 border-b border-black/70 bg-[#1a2320] px-3 py-2 sm:px-4">
        <div className={`${inventoryToolbarFiltersClass} min-w-0 flex-1`}>
          {headerSlot}
          {!truckTabOpen && categoryConfigs.length ? (
            <InlineSearchPicker
              value={selectedCategory}
              onChange={selectCategory}
              placeholder="Categoría"
              searchPlaceholder="Buscar categoría…"
              emptyLabel="Sin categorías"
              ariaLabel="Categoría de inventario"
              leadingIcon={<Layers3 className="h-4 w-4" aria-hidden />}
              options={embeddedCategoryOptions}
              minWidthClass="min-w-[8.5rem] sm:min-w-[10rem]"
            />
          ) : null}
          {!truckTabOpen && selectedCategoryData && embeddedSubcategoryOptions.length > 1 ? (
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
              minWidthClass="min-w-[8.5rem] sm:min-w-[10rem]"
            />
          ) : null}
          {!truckTabOpen && selectedCategoryData ? (
            <InlineSearchCombobox
              value={itemQuery}
              onChange={setItemQuery}
              placeholder={itemSearchPlaceholder}
              emptyLabel="Sin items"
              ariaLabel="Buscar items"
              leadingIcon={<Search className="h-4 w-4" aria-hidden />}
              options={embeddedItemOptions}
              className="shrink-0"
              minWidthClass="w-[8.75rem] sm:w-[10rem]"
              persistent
            />
          ) : null}
          {!truckTabOpen && showStructureOptions ? (
            <div className={inventoryToolbarGroupClass}>
              <InventoryToolbarIconButton
                    buttonRef={newItemButtonRef}
                    icon={Plus}
                    label="Agregar artículo"
                    showLabel
                    visibleLabel="Agregar"
                    tone={showNewItemForm ? "active" : "primary"}
                    disabled={!selectedCategoryData}
                    ariaExpanded={showNewItemForm}
                    ariaHaspopup="dialog"
                    onboardingTarget={ONBOARDING_TARGETS.INVENTORY_STRUCTURE_MENU}
                    onClick={() => {
                      if (showNewItemForm) {
                        setShowNewItemForm(false);
                        return;
                      }

                      beginAddItem();
                    }}
                  />
              <div className="relative">
                <InventoryToolbarIconButton
                  buttonRef={toolbarMenuButtonRef}
                  icon={MoreHorizontal}
                  label="Más acciones de inventario"
                  tone={toolbarMenuOpen ? "active" : "default"}
                  ariaExpanded={toolbarMenuOpen}
                  ariaHaspopup="menu"
                  onClick={() => setToolbarMenuOpen((current) => !current)}
                />
                {toolbarMenuOpen ? (
                  <div
                    ref={toolbarMenuRef}
                    role="menu"
                    onClick={(event) => {
                      if (
                        (event.target as HTMLElement).closest(
                          "[data-inventory-toolbar-menu-action]",
                        )
                      ) {
                        setToolbarMenuOpen(false);
                      }
                    }}
                    className="absolute right-0 top-[calc(100%+0.5rem)] z-[120] w-64 rounded-lg border border-black bg-[#101820] p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
                  >
                    {toolbarEndSlot}
                    <div className="my-1.5 border-t border-black/70" />
                    <button
                      type="button"
                      onClick={() => {
                        setToolbarMenuOpen(false);
                        setShowNewCategoryInput(false);
                        setOpenSubcategoryInput("");
                        openStructureMenu(toolbarMenuButtonRef.current!, "create");
                      }}
                      className="flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs font-black text-slate-300 transition hover:bg-surface-card-hover hover:text-[#f8fafc]"
                    >
                      <Layers3 className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                      Categorías y subcategorías
                    </button>
                    <button
                      type="button"
                      disabled={!selectedCategoryData}
                      onClick={() => {
                        setToolbarMenuOpen(false);
                        openStructureMenu(toolbarMenuButtonRef.current!, "manage");
                      }}
                      className="flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs font-black text-slate-300 transition hover:bg-surface-card-hover hover:text-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Settings2 className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                      Gestionar estructura
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
        <dl className="ml-auto flex shrink-0 overflow-hidden rounded-xl border border-black bg-[#17201d]">
          <div className="min-w-[5.5rem] border-r border-black/70 px-2.5 py-2">
            <dt className="text-[9px] font-black uppercase tracking-wider text-slate-500">
              Artículos
            </dt>
            <dd className="mt-0.5 text-base font-black tabular-nums text-slate-100">
              {inventoryOverview.itemCount}
            </dd>
          </div>
          <button
            type="button"
            className={`min-w-[5.5rem] border-r border-black/70 px-2.5 py-2 text-left transition ${
              !truckTabOpen ? "bg-emerald-400/10" : "hover:bg-white/[0.03]"
            }`}
            onClick={() => onTruckTabChange?.(false)}
            aria-pressed={!truckTabOpen}
          >
            <dt className="text-[9px] font-black uppercase tracking-wider text-slate-500">
              En bodega
            </dt>
            <dd className="mt-0.5 text-base font-black tabular-nums text-emerald-300">
              {inventoryOverview.warehouseQty}
            </dd>
          </button>
          <button
            type="button"
            className={`min-w-[5.5rem] border-r border-black/70 px-2.5 py-2 text-left transition ${
              truckTabOpen ? "bg-sky-400/10" : "hover:bg-white/[0.03]"
            }`}
            onClick={() => onTruckTabChange?.(true)}
            aria-pressed={truckTabOpen}
          >
            <dt className="text-[9px] font-black uppercase tracking-wider text-slate-500">
              En camiones
            </dt>
            <dd className="mt-0.5 text-base font-black tabular-nums text-sky-300">
              {truckQty}
            </dd>
          </button>
          <div className="min-w-[5.5rem] border-r border-black/70 px-2.5 py-2">
            <dt className="text-[9px] font-black uppercase tracking-wider text-slate-500">
              Con empleados
            </dt>
            <dd className="mt-0.5 flex items-baseline gap-1 text-base font-black tabular-nums text-violet-300">
              {inventoryOverview.assignedQty}
              {inventoryOverview.activeAssignments ? (
                <span className="text-[9px] font-bold text-violet-300/60">
                  {inventoryOverview.activeAssignments} entregas
                </span>
              ) : null}
            </dd>
          </div>
          <div className="min-w-[5.5rem] px-2.5 py-2">
            <dt className="text-[9px] font-black uppercase tracking-wider text-slate-500">
              Por revisar
            </dt>
            <dd
              className={`mt-0.5 text-base font-black tabular-nums ${
                inventoryOverview.attentionCount ? "text-amber-300" : "text-slate-300"
              }`}
            >
              {inventoryOverview.attentionCount}
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {truckTabOpen && truckPanel ? truckPanel : itemsPanel}
      </div>

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
      <InventoryStructureOptionsMenu
        embedded={embedded}
        showStructureOptions={showStructureOptions}
        optionsOpen={optionsOpen}
        mode={structureMenuMode}
        structureMenuPosition={structureMenuPosition}
        structureMenuMounted={structureMenuMounted}
        structurePanelRef={structurePanelRef}
        showNewCategoryInput={showNewCategoryInput}
        setShowNewCategoryInput={setShowNewCategoryInput}
        setOpenSubcategoryInput={setOpenSubcategoryInput}
        newCategoryName={newCategoryName}
        setNewCategoryName={setNewCategoryName}
        selectedCategoryData={selectedCategoryData}
        selectedSubcategory={selectedSubcategory}
        addingSubcategoryForSelectedCategory={addingSubcategoryForSelectedCategory}
        addCategory={addCategory}
        beginAddSubcategory={beginAddSubcategory}
        renderSubcategoryForm={renderSubcategoryForm}
        showStructureDelete={showStructureDelete && structureMenuMode === "manage"}
        selectedCategoryName={selectedCategory}
        deleteCategory={deleteCategory}
        deleteSubcategory={deleteSubcategory}
      />
      <InventoryNewItemPopover
        open={showNewItemForm}
        mounted={structureMenuMounted}
        position={newItemPopoverPosition}
        anchorRef={newItemButtonRef}
        panelRef={newItemPopoverRef}
        selectedCategoryData={selectedCategoryData}
        selectedSubcategory={selectedSubcategory}
        itemPlaceholder={itemPlaceholder}
        value={newNameByKey[itemInputKey] || ""}
        onChange={(nextValue) =>
          setNewNameByKey((current) => ({
            ...current,
            [itemInputKey]: nextValue,
          }))
        }
        onAdd={addItem}
        onClose={() => setShowNewItemForm(false)}
        pricingReturnHref={pricingReturnHref}
        pricingReturnLabel={pricingReturnLabel}
      />
    </>
  );
}
