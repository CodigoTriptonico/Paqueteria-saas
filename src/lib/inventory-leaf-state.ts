import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveInventoryLeafItem,
  type DbInventoryItemRow,
} from "@/lib/inventory-backend";
import type { InventoryStockItem } from "@/lib/inventory-stock";

export type InventoryLeafInput = {
  warehouseId: string;
  category: string;
  kind: string;
  subcategory?: string;
  itemName: string;
  minStock?: number;
};

type InventoryLeafStockRow = {
  id: string;
  stock: number;
  reserved: number;
  assigned: number;
  unavailable: number;
  min_stock: number;
};

export type InventoryLeafState = {
  categoryName: string;
  itemName: string;
  kind: string;
  subcategory: string | null;
  minStock: number;
  itemRow: DbInventoryItemRow;
  stockRow: InventoryLeafStockRow;
};

type InventoryLeafStateResult =
  | { ok: true; data: InventoryLeafState }
  | { ok: false; error: string };

export function normalizeInventoryLeafInput(input: InventoryLeafInput) {
  const categoryName = input.category.trim();
  const itemName = input.itemName.trim() || input.kind.trim();

  return {
    categoryName,
    itemName,
    kind: input.kind.trim() || itemName,
    subcategory: input.subcategory?.trim() || null,
    minStock: input.minStock ?? 2,
  };
}

export function inventoryLeafStateToItem(
  state: InventoryLeafState,
  stock = Number(state.stockRow.stock || 0),
): InventoryStockItem {
  const { categoryName, itemName, kind, subcategory, minStock, itemRow, stockRow } =
    state;

  return {
    id: itemRow.id,
    name: itemRow.name || itemName,
    category: categoryName,
    kind: itemRow.kind || kind,
    subcategory: itemRow.subcategory || subcategory || undefined,
    size: itemRow.size || undefined,
    stock,
    reserved: Number(stockRow.reserved || 0),
    assigned: Number(stockRow.assigned ?? 0),
    unavailable: Number(stockRow.unavailable ?? 0),
    minStock: Number(stockRow.min_stock ?? minStock),
    location: itemRow.location || undefined,
    unit: itemRow.unit || undefined,
  };
}

export async function ensureInventoryLeafState(
  supabase: SupabaseClient,
  organizationId: string,
  input: InventoryLeafInput,
): Promise<InventoryLeafStateResult> {
  const normalized = normalizeInventoryLeafInput(input);
  const { categoryName, itemName, kind, subcategory, minStock } = normalized;

  const { data: existingCategory, error: categoryError } = await supabase
    .from("inventory_categories")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("name", categoryName)
    .maybeSingle();

  if (categoryError) {
    return { ok: false, error: categoryError.message };
  }

  let categoryId = existingCategory?.id || "";

  if (!categoryId) {
    const { data: insertedCategory, error: insertCategoryError } = await supabase
      .from("inventory_categories")
      .insert({
        organization_id: organizationId,
        name: categoryName,
        tree_data: [],
      })
      .select("id")
      .single();

    if (insertCategoryError || !insertedCategory) {
      return {
        ok: false,
        error: insertCategoryError?.message || "No se pudo crear categoria",
      };
    }

    categoryId = insertedCategory.id;
  }

  const { data: existingItem, error: itemError } = await resolveInventoryLeafItem(
    supabase,
    {
      organizationId,
      categoryId,
      kind,
      subcategory,
      warehouseId: input.warehouseId,
    },
  );

  if (itemError) {
    return { ok: false, error: itemError };
  }

  let itemRow = existingItem;

  if (!itemRow?.id) {
    const { data: insertedItem, error: insertItemError } = await supabase
      .from("inventory_items")
      .insert({
        organization_id: organizationId,
        category_id: categoryId,
        name: itemName,
        kind,
        subcategory,
      })
      .select("id, name, kind, subcategory, size, location, unit")
      .single();

    if (insertItemError || !insertedItem) {
      return {
        ok: false,
        error: insertItemError?.message || "No se pudo crear item",
      };
    }

    itemRow = insertedItem as DbInventoryItemRow;
  }

  const { data: existingStock, error: stockError } = await supabase
    .from("inventory_stock")
    .select("id, stock, reserved, assigned, unavailable, min_stock")
    .eq("warehouse_id", input.warehouseId)
    .eq("item_id", itemRow.id)
    .maybeSingle();

  if (stockError) {
    return { ok: false, error: stockError.message };
  }

  let stockRow = existingStock as InventoryLeafStockRow | null;

  if (!stockRow?.id) {
    const { data: insertedStock, error: insertStockError } = await supabase
      .from("inventory_stock")
      .insert({
        organization_id: organizationId,
        warehouse_id: input.warehouseId,
        item_id: itemRow.id,
        stock: 0,
        reserved: 0,
        assigned: 0,
        unavailable: 0,
        min_stock: minStock,
      })
      .select("id, stock, reserved, assigned, unavailable, min_stock")
      .single();

    if (insertStockError || !insertedStock) {
      return {
        ok: false,
        error: insertStockError?.message || "No se pudo crear stock",
      };
    }

    stockRow = insertedStock as InventoryLeafStockRow;
  }

  return {
    ok: true,
    data: {
      ...normalized,
      itemRow,
      stockRow,
    },
  };
}
