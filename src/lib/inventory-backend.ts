import type { InventoryMovement } from "@/lib/inventory-types";
import type { InventoryStockItem } from "@/lib/inventory-stock";
import type { CategoryConfig, InventoryTreeItem } from "@/lib/inventory-tree";

export type DbCategory = {
  id: string;
  name: string;
  tree_data: InventoryTreeItem[];
};

export type DbStockRow = {
  id: string;
  item_id: string;
  warehouse_id: string;
  stock: number;
  reserved: number;
  min_stock: number;
  inventory_items: {
    id: string;
    name: string;
    kind: string;
    subcategory: string | null;
    size: string | null;
    location: string | null;
    unit: string | null;
    category_id: string;
    inventory_categories: { name: string };
  };
};

export function categoriesToConfig(rows: DbCategory[]): CategoryConfig[] {
  return rows.map((row) => ({
    name: row.name,
    items: (row.tree_data || []) as InventoryTreeItem[],
  }));
}

export function stockRowsToItems(rows: DbStockRow[]): InventoryStockItem[] {
  return rows.map((row) => {
    const item = row.inventory_items;
    const categoryName = item.inventory_categories?.name || "";

    return {
      id: row.item_id,
      name: item.name,
      category: categoryName,
      kind: item.kind,
      subcategory: item.subcategory || undefined,
      size: item.size || undefined,
      location: item.location || undefined,
      unit: item.unit || undefined,
      stock: Number(row.stock),
      reserved: Number(row.reserved),
      minStock: Number(row.min_stock),
    };
  });
}

export function movementsFromDb(
  rows: {
    id: string;
    item_id: string;
    item_name: string;
    type: "entrada" | "salida" | "ajuste";
    qty: number;
    note: string;
    created_at: string;
  }[],
): InventoryMovement[] {
  return rows.map((row) => ({
    id: row.id,
    itemId: row.item_id,
    itemName: row.item_name,
    type: row.type,
    qty: Number(row.qty),
    note: row.note || "",
    createdAt: row.created_at,
  }));
}
