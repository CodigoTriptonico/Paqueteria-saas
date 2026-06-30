import type { InventoryMovement } from "@/lib/inventory-types";
import {
  inventoryItemsForLeaf,
  type InventoryStockItem,
} from "@/lib/inventory-stock";
import {
  categoryItems,
  isInventoryGroup,
  normalizeInventoryText,
  type CategoryConfig,
  type InventoryTreeItem,
} from "@/lib/inventory-tree";

export type ItemContextMenu = {
  x: number;
  y: number;
  treeItem: InventoryTreeItem;
  stockItem: InventoryStockItem;
  categoryName: string;
  subcategoryName?: string;
};

export type MovementDraft = {
  type: "entrada" | "salida" | "ajuste";
  qty: string;
  note: string;
  context: ItemContextMenu;
};

export type CategoryLeafEntry = {
  item: InventoryTreeItem;
  subcategoryName?: string;
};

export const INVENTORY_CATEGORIES_CONFIG_HREF =
  "/configuracion?view=inventory&inventory=categories";

export const STRUCTURE_MENU_WIDTH = 320;

export const itemsGridClass =
  "grid grid-cols-[repeat(auto-fill,minmax(272px,1fr))] gap-3 sm:gap-4";

export const addBtnClass =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-400 text-slate-950 transition hover:brightness-110";

export const iconBtnClass =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-300 transition hover:bg-surface-card-hover hover:text-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-40";

export const countBadgeClass =
  "inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md border border-black bg-surface-inset px-1.5 text-[11px] font-semibold tabular-nums text-slate-200";

export const categoryCardSelectedClass = "border-black bg-emerald-400/10";

export const subcategoryRowSelectedClass = "border-black bg-emerald-400/10";

export const categoryCardClass = (active: boolean) =>
  `overflow-hidden rounded-lg border transition ${
    active
      ? categoryCardSelectedClass
      : "border-black bg-surface-card/55 hover:bg-surface-card-hover"
  }`;

export const categoryHeaderClass = (selected: boolean, hasSubsBelow: boolean) =>
  `group min-w-0 border-black transition ${
    hasSubsBelow ? "border-b border-black/70" : ""
  } ${selected ? "bg-transparent" : "hover:bg-surface-card-hover"}`;

export const rowActionsBarClass = "flex items-center justify-end gap-0.5 px-2 pb-2";

export const subcategoryPanelClass =
  "mx-2 mb-2 flex min-w-0 flex-col gap-1.5 border-l border-black/40 pl-2 py-1";

export const subcategoryRowClass = (selected: boolean) =>
  `group flex min-w-0 flex-col overflow-hidden rounded-md border transition ${
    selected
      ? subcategoryRowSelectedClass
      : "border-black hover:bg-surface-card-hover"
  }`;

export function formatScopedItemCount(count: number, scope: string) {
  return `${count} ${count === 1 ? "item" : "items"} en ${scope}`;
}

export function stockItemForTreeItem(
  inventoryItems: InventoryStockItem[],
  categoryName: string,
  item: InventoryTreeItem,
  subcategoryName?: string,
): InventoryStockItem {
  const leafItems = inventoryItemsForLeaf(
    inventoryItems,
    categoryName,
    item.name,
    subcategoryName,
  );

  if (leafItems.length > 0) {
    return leafItems[0];
  }

  return {
    id: `virtual-leaf-${item.id}`,
    name: item.name,
    category: categoryName,
    kind: item.name,
    subcategory: subcategoryName,
    stock: 0,
    reserved: 0,
    assigned: 0,
    unavailable: 0,
    minStock: 2,
  };
}

export const INVENTORY_ITEM_CARD_SELECTOR = "[data-inventory-item-id]";

export const INVENTORY_ITEMS_SURFACE_SELECTOR = "[data-inventory-items-surface]";

const INTERACTIVE_SELECTOR =
  "button, input, textarea, select, a, [role='combobox'], [role='menu'], [data-inventory-empty-context-menu], [data-inventory-item-context-menu]";

export { INTERACTIVE_SELECTOR };

export function categoryLeafEntries(category: CategoryConfig): CategoryLeafEntry[] {
  const entries: CategoryLeafEntry[] = [];

  for (const node of categoryItems(category)) {
    if (isInventoryGroup(node)) {
      for (const child of node.children || []) {
        entries.push({ item: child, subcategoryName: node.name });
      }
    } else {
      entries.push({ item: node });
    }
  }

  return entries;
}

export function movementsForItem(
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

export function sameStockLeaf(
  item: InventoryStockItem,
  categoryName: string,
  kind: string,
  subcategoryName?: string,
) {
  return (
    normalizeInventoryText(item.category) === normalizeInventoryText(categoryName) &&
    normalizeInventoryText(item.kind) === normalizeInventoryText(kind) &&
    normalizeInventoryText(item.subcategory || "") ===
      normalizeInventoryText(subcategoryName || "")
  );
}
