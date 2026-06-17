"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAppSession } from "@/lib/auth/session";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { canAccessWarehouse } from "@/lib/auth/permissions";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import {
  actionErrorMessage,
  fail,
  ok,
  type ActionResult,
} from "@/lib/actions/errors";
import {
  ASSIGNMENT_SELECT,
  assignmentsFromDb,
  categoriesToConfig,
  movementsFromDb,
  MOVEMENT_SELECT,
  stockRowsToItems,
  type DbAssignmentRow,
  type DbCategory,
  type DbStockRow,
} from "@/lib/inventory-backend";
import type { InventoryAssignment, InventoryMovement } from "@/lib/inventory-types";
import type { InventoryStockItem } from "@/lib/inventory-stock";
import type { CategoryConfig } from "@/lib/inventory-tree";
import {
  collectCategoryTreeLeaves,
  mergeTreeIntoInventoryItems,
} from "@/lib/inventory-stock";

export type WarehouseInventoryCorePayload = {
  categoryConfigs: CategoryConfig[];
  items: InventoryStockItem[];
};

export type WarehouseInventoryHistoryPayload = {
  movements: InventoryMovement[];
  assignments: InventoryAssignment[];
};

export type WarehouseInventoryPayload = WarehouseInventoryCorePayload &
  WarehouseInventoryHistoryPayload;

async function loadWarehouseInventoryCore(
  supabase: SupabaseClient,
  organizationId: string,
  warehouseId: string,
): Promise<ActionResult<WarehouseInventoryCorePayload>> {
  const [{ data: categories, error: catError }, { data: stockRows, error: stockError }] =
    await Promise.all([
      supabase
        .from("inventory_categories")
        .select("id, name, tree_data")
        .eq("organization_id", organizationId)
        .order("name"),
      supabase
        .from("inventory_stock")
        .select(
          "id, item_id, warehouse_id, stock, reserved, assigned, unavailable, min_stock, inventory_items(id, name, kind, subcategory, size, location, unit, category_id, inventory_categories(name))",
        )
        .eq("warehouse_id", warehouseId)
        .eq("organization_id", organizationId),
    ]);

  if (catError) {
    return fail(catError.message);
  }

  if (stockError) {
    return fail(stockError.message);
  }

  const categoryConfigs = categoriesToConfig((categories || []) as DbCategory[]);
  let items = stockRowsToItems((stockRows || []) as unknown as DbStockRow[]);
  items = mergeTreeIntoInventoryItems(categoryConfigs, items);

  return ok({ categoryConfigs, items });
}

async function loadWarehouseInventoryHistory(
  supabase: SupabaseClient,
  organizationId: string,
  warehouseId: string,
): Promise<ActionResult<WarehouseInventoryHistoryPayload>> {
  const [{ data: movementRows, error: movError }, { data: assignmentRows, error: assignError }] =
    await Promise.all([
      supabase
        .from("inventory_movements")
        .select(MOVEMENT_SELECT)
        .eq("warehouse_id", warehouseId)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("inventory_assignments")
        .select(ASSIGNMENT_SELECT)
        .eq("warehouse_id", warehouseId)
        .eq("organization_id", organizationId)
        .eq("status", "open")
        .order("assigned_at", { ascending: false }),
    ]);

  if (movError) {
    return fail(movError.message);
  }

  if (assignError) {
    return fail(assignError.message);
  }

  return ok({
    movements: movementsFromDb(movementRows || []),
    assignments: assignmentsFromDb((assignmentRows || []) as DbAssignmentRow[]),
  });
}

async function requireInventoryWarehouseAccess(warehouseId: string) {
  const session = await requireAppSession();

  if (!sessionHasPermission(session, "inventory.view")) {
    throw new Error("FORBIDDEN");
  }

  if (!canAccessWarehouse(session, warehouseId)) {
    throw new Error("FORBIDDEN");
  }

  const supabase = await createScopedSupabase(session);
  if (!supabase) {
    return { session, supabase: null as SupabaseClient | null };
  }

  return { session, supabase };
}

export async function loadWarehouseInventoryCoreAction(
  warehouseId: string,
): Promise<ActionResult<WarehouseInventoryCorePayload>> {
  try {
    const { session, supabase } = await requireInventoryWarehouseAccess(warehouseId);

    if (!supabase) {
      return fail("Supabase no configurado");
    }

    return loadWarehouseInventoryCore(supabase, session.organizationId, warehouseId);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function loadWarehouseInventoryHistoryAction(
  warehouseId: string,
): Promise<ActionResult<WarehouseInventoryHistoryPayload>> {
  try {
    const { session, supabase } = await requireInventoryWarehouseAccess(warehouseId);

    if (!supabase) {
      return fail("Supabase no configurado");
    }

    return loadWarehouseInventoryHistory(supabase, session.organizationId, warehouseId);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function loadWarehouseInventoryAction(
  warehouseId: string,
): Promise<ActionResult<WarehouseInventoryPayload>> {
  try {
    const { session, supabase } = await requireInventoryWarehouseAccess(warehouseId);

    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const [coreResult, historyResult] = await Promise.all([
      loadWarehouseInventoryCore(supabase, session.organizationId, warehouseId),
      loadWarehouseInventoryHistory(supabase, session.organizationId, warehouseId),
    ]);

    if (!coreResult.ok) {
      return fail(coreResult.error);
    }

    if (!historyResult.ok) {
      return fail(historyResult.error);
    }

    return ok({
      ...coreResult.data,
      ...historyResult.data,
    });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function saveInventoryCategoriesAction(
  categoryConfigs: CategoryConfig[],
): Promise<ActionResult<null>> {
  try {
    const session = await requireAppSession();

    if (
      !sessionHasPermission(session, "settings.manage") &&
      !sessionHasPermission(session, "warehouses.manage") &&
      !sessionHasPermission(session, "inventory.adjust")
    ) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data: existing } = await supabase
      .from("inventory_categories")
      .select("id, name")
      .eq("organization_id", session.organizationId);

    if (categoryConfigs.length === 0 && (existing || []).length > 0) {
      return fail("No se puede borrar todo el inventario desde un estado vacío");
    }

    const existingByName = new Map(
      (existing || []).map((row) => [row.name, row.id]),
    );
    const incomingNames = new Set(categoryConfigs.map((cat) => cat.name));

    for (const category of categoryConfigs) {
      const payload = {
        organization_id: session.organizationId,
        name: category.name,
        tree_data: category.items || [],
      };

      const existingId = existingByName.get(category.name);

      if (existingId) {
        const { error } = await supabase
          .from("inventory_categories")
          .update({ tree_data: payload.tree_data })
          .eq("id", existingId);

        if (error) {
          return fail(error.message);
        }
      } else {
        const { error } = await supabase
          .from("inventory_categories")
          .insert(payload);

        if (error) {
          return fail(error.message);
        }
      }
    }

    const toDelete = (existing || []).filter(
      (row) => !incomingNames.has(row.name),
    );

    if (toDelete.length) {
      const { error } = await supabase
        .from("inventory_categories")
        .delete()
        .in(
          "id",
          toDelete.map((row) => row.id),
        );

      if (error) {
        return fail(error.message);
      }
    }

    return ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

async function ensureItemsForWarehouse(
  supabase: SupabaseClient,
  organizationId: string,
  warehouseId: string,
  categoryConfigs: CategoryConfig[],
  items: InventoryStockItem[],
) {
  const { data: categories } = await supabase
    .from("inventory_categories")
    .select("id, name")
    .eq("organization_id", organizationId);

  const categoryIdByName = new Map(
    (categories || []).map((row) => [row.name, row.id]),
  );

  for (const leaf of categoryConfigs.flatMap((category) =>
    collectCategoryTreeLeaves(category).map((entry) => ({
      ...entry,
      categoryId: categoryIdByName.get(category.name),
    })),
  )) {
    if (!leaf.categoryId) {
      continue;
    }

    const match = items.find(
      (item) =>
        item.category === leaf.category &&
        item.kind === leaf.kind &&
        (item.subcategory || "") === (leaf.subcategory || ""),
    );

    let itemId = match?.id;

    if (!itemId || itemId.startsWith("inv-") || itemId.startsWith("virtual-")) {
      const { data: existingItem } = await supabase
        .from("inventory_items")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("category_id", leaf.categoryId)
        .eq("kind", leaf.kind)
        .eq("subcategory", leaf.subcategory || null)
        .maybeSingle();

      if (existingItem?.id) {
        itemId = existingItem.id;
      } else {
        const { data: inserted, error } = await supabase
          .from("inventory_items")
          .insert({
            organization_id: organizationId,
            category_id: leaf.categoryId,
            name: leaf.name,
            kind: leaf.kind,
            subcategory: leaf.subcategory || null,
          })
          .select("id")
          .single();

        if (error || !inserted) {
          throw new Error(error?.message || "No se pudo crear item");
        }

        itemId = inserted.id;
      }
    }

    const stockItem = items.find((item) => item.id === match?.id) || match;

    const { data: stockRow } = await supabase
      .from("inventory_stock")
      .select("id")
      .eq("warehouse_id", warehouseId)
      .eq("item_id", itemId)
      .maybeSingle();

    const stockPayload = {
      organization_id: organizationId,
      warehouse_id: warehouseId,
      item_id: itemId,
      stock: stockItem?.stock ?? 0,
      reserved: stockItem?.reserved ?? 0,
      min_stock: stockItem?.minStock ?? 2,
    };

    if (stockRow?.id) {
      await supabase
        .from("inventory_stock")
        .update({
          stock: stockPayload.stock,
          reserved: stockPayload.reserved,
          min_stock: stockPayload.min_stock,
        })
        .eq("id", stockRow.id);
    } else {
      await supabase.from("inventory_stock").insert(stockPayload);
    }
  }
}

export async function saveWarehouseStockAction(input: {
  warehouseId: string;
  categoryConfigs: CategoryConfig[];
  items: InventoryStockItem[];
}): Promise<ActionResult<null>> {
  try {
    const session = await requireAppSession();

    if (
      !sessionHasPermission(session, "inventory.adjust") &&
      !sessionHasPermission(session, "inventory.reserve")
    ) {
      throw new Error("FORBIDDEN");
    }

    if (!canAccessWarehouse(session, input.warehouseId)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    await ensureItemsForWarehouse(
      supabase,
      session.organizationId,
      input.warehouseId,
      input.categoryConfigs,
      input.items,
    );

    return ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function saveWarehouseInventoryAction(input: {
  warehouseId: string;
  categoryConfigs: CategoryConfig[];
  items: InventoryStockItem[];
}): Promise<ActionResult<null>> {
  try {
    const session = await requireAppSession();

    if (
      !sessionHasPermission(session, "inventory.adjust") &&
      !sessionHasPermission(session, "inventory.reserve")
    ) {
      throw new Error("FORBIDDEN");
    }

    if (!canAccessWarehouse(session, input.warehouseId)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const categoriesResult = await saveInventoryCategoriesAction(
      input.categoryConfigs,
    );

    if (!categoriesResult.ok) {
      return categoriesResult;
    }

    await ensureItemsForWarehouse(
      supabase,
      session.organizationId,
      input.warehouseId,
      input.categoryConfigs,
      input.items,
    );

    return ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function deductStockForBoxSaleAction(input: {
  boxLabel: string;
  warehouseId?: string;
  qty?: number;
  note?: string;
}): Promise<ActionResult<InventoryMovement | null>> {
  try {
    const session = await requireAppSession();
    const supabase = await createScopedSupabase(session);

    if (!supabase) {
      return ok(null);
    }

    let warehouseId = input.warehouseId;

    if (!warehouseId) {
      const { data: warehouse } = await supabase
        .from("warehouses")
        .select("id")
        .eq("organization_id", session.organizationId)
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle();

      warehouseId = warehouse?.id;
    }

    if (!warehouseId) {
      return fail("No hay bodega activa");
    }

    const normalizedBox = input.boxLabel
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/\s+/g, "");

    const { data: stockRows, error: stockError } = await supabase
      .from("inventory_stock")
      .select("item_id, stock, inventory_items(id, name, kind)")
      .eq("warehouse_id", warehouseId)
      .eq("organization_id", session.organizationId);

    if (stockError) {
      return fail(stockError.message);
    }

    const match = (stockRows || []).find((row) => {
      const itemRow = row.inventory_items as
        | { id: string; name: string; kind: string }
        | { id: string; name: string; kind: string }[]
        | null;
      const item = Array.isArray(itemRow) ? itemRow[0] : itemRow;
      if (!item) {
        return false;
      }

      const candidates = [
        item.kind,
        item.name,
        `Caja ${item.kind}`,
        `Caja ${item.name}`,
      ];
      return candidates.some(
        (value) =>
          value
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .toLowerCase()
            .replace(/\s+/g, "")
            .includes(normalizedBox) ||
          normalizedBox.includes(
            value
              .normalize("NFD")
              .replace(/\p{Diacritic}/gu, "")
              .toLowerCase()
              .replace(/\s+/g, ""),
          ),
      );
    });

    if (!match) {
      return fail(`No hay stock registrado para la caja ${input.boxLabel}`);
    }

    const itemRow = match.inventory_items as
      | { id: string; name: string; kind: string }
      | { id: string; name: string; kind: string }[];
    const item = Array.isArray(itemRow) ? itemRow[0] : itemRow;
    const qty = input.qty ?? 1;

    if (Number(match.stock) < qty) {
      return fail(`Stock insuficiente para ${input.boxLabel}`);
    }

    return recordInventoryMovementAction({
      warehouseId,
      itemId: item.id,
      itemName: item.name || item.kind,
      type: "salida",
      qty,
      note: input.note || `Venta caja ${input.boxLabel}`,
    });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function recordInventoryMovementAction(input: {
  warehouseId: string;
  itemId: string;
  itemName: string;
  type: "entrada" | "salida" | "ajuste";
  qty: number;
  note?: string;
}): Promise<ActionResult<InventoryMovement>> {
  try {
    const session = await requireAppSession();

    const canAdjust = sessionHasPermission(session, "inventory.adjust");
    const canReserve = sessionHasPermission(session, "inventory.reserve");

    if ((input.type === "entrada" || input.type === "ajuste") && !canAdjust) {
      throw new Error("FORBIDDEN");
    }

    if (input.type === "salida" && !canReserve && !canAdjust) {
      throw new Error("FORBIDDEN");
    }

    if (!canAccessWarehouse(session, input.warehouseId)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data: stockRow, error: stockError } = await supabase
      .from("inventory_stock")
      .select("id, stock, reserved")
      .eq("warehouse_id", input.warehouseId)
      .eq("item_id", input.itemId)
      .maybeSingle();

    if (stockError || !stockRow) {
      return fail("Stock no encontrado para este item");
    }

    let nextStock = Number(stockRow.stock);

    if (input.type === "entrada") {
      nextStock += input.qty;
    } else if (input.type === "salida") {
      nextStock = Math.max(0, nextStock - input.qty);
    } else {
      nextStock = input.qty;
    }

    const { error: updateError } = await supabase
      .from("inventory_stock")
      .update({ stock: nextStock })
      .eq("id", stockRow.id);

    if (updateError) {
      return fail(updateError.message);
    }

    const { data: movement, error: movError } = await supabase
      .from("inventory_movements")
      .insert({
        organization_id: session.organizationId,
        warehouse_id: input.warehouseId,
        item_id: input.itemId,
        item_name: input.itemName,
        type: input.type,
        qty: input.qty,
        note: input.note || "",
        created_by: session.userId,
      })
      .select(MOVEMENT_SELECT)
      .single();

    if (movError || !movement) {
      return fail(movError?.message || "No se pudo registrar el movimiento");
    }

    return ok(movementsFromDb([movement])[0]);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function ensureInventoryLeafItemAction(input: {
  warehouseId: string;
  category: string;
  kind: string;
  subcategory?: string;
  itemName: string;
  minStock?: number;
}): Promise<ActionResult<InventoryStockItem>> {
  try {
    const session = await requireAppSession();

    if (
      !sessionHasPermission(session, "inventory.view") &&
      !sessionHasPermission(session, "inventory.assign")
    ) {
      throw new Error("FORBIDDEN");
    }

    if (!canAccessWarehouse(session, input.warehouseId)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const categoryName = input.category.trim();
    const itemName = input.itemName.trim() || input.kind.trim();
    const kind = input.kind.trim() || itemName;
    const subcategory = input.subcategory?.trim() || null;
    const minStock = input.minStock ?? 2;

    let categoryId = "";
    const { data: existingCategory, error: categoryError } = await supabase
      .from("inventory_categories")
      .select("id")
      .eq("organization_id", session.organizationId)
      .eq("name", categoryName)
      .maybeSingle();

    if (categoryError) {
      return fail(categoryError.message);
    }

    if (existingCategory?.id) {
      categoryId = existingCategory.id;
    } else {
      const { data: insertedCategory, error: insertCategoryError } =
        await supabase
          .from("inventory_categories")
          .insert({
            organization_id: session.organizationId,
            name: categoryName,
            tree_data: [],
          })
          .select("id")
          .single();

      if (insertCategoryError || !insertedCategory) {
        return fail(
          insertCategoryError?.message || "No se pudo crear categoria",
        );
      }

      categoryId = insertedCategory.id;
    }

    let itemQuery = supabase
      .from("inventory_items")
      .select("id, name, kind, subcategory, size, location, unit")
      .eq("organization_id", session.organizationId)
      .eq("category_id", categoryId)
      .eq("kind", kind);

    itemQuery = subcategory
      ? itemQuery.eq("subcategory", subcategory)
      : itemQuery.is("subcategory", null);

    const { data: existingItem, error: itemError } =
      await itemQuery.maybeSingle();

    if (itemError) {
      return fail(itemError.message);
    }

    let itemRow = existingItem;

    if (!itemRow?.id) {
      const { data: insertedItem, error: insertItemError } = await supabase
        .from("inventory_items")
        .insert({
          organization_id: session.organizationId,
          category_id: categoryId,
          name: itemName,
          kind,
          subcategory,
        })
        .select("id, name, kind, subcategory, size, location, unit")
        .single();

      if (insertItemError || !insertedItem) {
        return fail(insertItemError?.message || "No se pudo crear item");
      }

      itemRow = insertedItem;
    }

    const { data: existingStockRow, error: stockError } = await supabase
      .from("inventory_stock")
      .select("id, stock, reserved, assigned, unavailable, min_stock")
      .eq("warehouse_id", input.warehouseId)
      .eq("item_id", itemRow.id)
      .maybeSingle();

    if (stockError) {
      return fail(stockError.message);
    }

    let stockRow = existingStockRow;

    if (!stockRow?.id) {
      const { data: insertedStock, error: insertStockError } = await supabase
        .from("inventory_stock")
        .insert({
          organization_id: session.organizationId,
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
        return fail(insertStockError?.message || "No se pudo crear stock");
      }

      stockRow = insertedStock;
    }

    return ok({
      id: itemRow.id,
      name: itemRow.name || itemName,
      category: categoryName,
      kind: itemRow.kind || kind,
      subcategory: itemRow.subcategory || undefined,
      size: itemRow.size || undefined,
      stock: Number(stockRow.stock || 0),
      reserved: Number(stockRow.reserved || 0),
      assigned: Number(stockRow.assigned ?? 0),
      unavailable: Number(stockRow.unavailable ?? 0),
      minStock: Number(stockRow.min_stock ?? minStock),
      location: itemRow.location || undefined,
      unit: itemRow.unit || undefined,
    });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function recordInventoryMovementForLeafAction(input: {
  warehouseId: string;
  category: string;
  kind: string;
  subcategory?: string;
  itemName: string;
  type: "entrada" | "salida" | "ajuste";
  qty: number;
  note?: string;
  minStock?: number;
}): Promise<
  ActionResult<{ item: InventoryStockItem; movement: InventoryMovement }>
> {
  try {
    const session = await requireAppSession();

    const canAdjust = sessionHasPermission(session, "inventory.adjust");
    const canReserve = sessionHasPermission(session, "inventory.reserve");

    if ((input.type === "entrada" || input.type === "ajuste") && !canAdjust) {
      throw new Error("FORBIDDEN");
    }

    if (input.type === "salida" && !canReserve && !canAdjust) {
      throw new Error("FORBIDDEN");
    }

    if (!canAccessWarehouse(session, input.warehouseId)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const categoryName = input.category.trim();
    const itemName = input.itemName.trim() || input.kind.trim();
    const kind = input.kind.trim() || itemName;
    const subcategory = input.subcategory?.trim() || null;
    const minStock = input.minStock ?? 2;

    let categoryId = "";
    const { data: existingCategory, error: categoryError } = await supabase
      .from("inventory_categories")
      .select("id")
      .eq("organization_id", session.organizationId)
      .eq("name", categoryName)
      .maybeSingle();

    if (categoryError) {
      return fail(categoryError.message);
    }

    if (existingCategory?.id) {
      categoryId = existingCategory.id;
    } else {
      const { data: insertedCategory, error: insertCategoryError } =
        await supabase
          .from("inventory_categories")
          .insert({
            organization_id: session.organizationId,
            name: categoryName,
            tree_data: [],
          })
          .select("id")
          .single();

      if (insertCategoryError || !insertedCategory) {
        return fail(
          insertCategoryError?.message || "No se pudo crear categoria",
        );
      }

      categoryId = insertedCategory.id;
    }

    let itemQuery = supabase
      .from("inventory_items")
      .select("id, name, kind, subcategory, size, location, unit")
      .eq("organization_id", session.organizationId)
      .eq("category_id", categoryId)
      .eq("kind", kind);

    itemQuery = subcategory
      ? itemQuery.eq("subcategory", subcategory)
      : itemQuery.is("subcategory", null);

    const { data: existingItem, error: itemError } =
      await itemQuery.maybeSingle();

    if (itemError) {
      return fail(itemError.message);
    }

    let itemRow = existingItem;

    if (!itemRow?.id) {
      const { data: insertedItem, error: insertItemError } = await supabase
        .from("inventory_items")
        .insert({
          organization_id: session.organizationId,
          category_id: categoryId,
          name: itemName,
          kind,
          subcategory,
        })
        .select("id, name, kind, subcategory, size, location, unit")
        .single();

      if (insertItemError || !insertedItem) {
        return fail(insertItemError?.message || "No se pudo crear item");
      }

      itemRow = insertedItem;
    }

    const { data: existingStockRow, error: stockError } = await supabase
      .from("inventory_stock")
      .select("id, stock, reserved, assigned, unavailable, min_stock")
      .eq("warehouse_id", input.warehouseId)
      .eq("item_id", itemRow.id)
      .maybeSingle();

    if (stockError) {
      return fail(stockError.message);
    }

    let stockRow = existingStockRow;

    if (!stockRow?.id) {
      const { data: insertedStock, error: insertStockError } = await supabase
        .from("inventory_stock")
        .insert({
          organization_id: session.organizationId,
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
        return fail(insertStockError?.message || "No se pudo crear stock");
      }

      stockRow = insertedStock;
    }

    let nextStock = Number(stockRow.stock || 0);

    if (input.type === "entrada") {
      nextStock += input.qty;
    } else if (input.type === "salida") {
      nextStock = Math.max(0, nextStock - input.qty);
    } else {
      nextStock = input.qty;
    }

    const { error: updateError } = await supabase
      .from("inventory_stock")
      .update({ stock: nextStock })
      .eq("id", stockRow.id);

    if (updateError) {
      return fail(updateError.message);
    }

    const { data: movement, error: movError } = await supabase
      .from("inventory_movements")
      .insert({
        organization_id: session.organizationId,
        warehouse_id: input.warehouseId,
        item_id: itemRow.id,
        item_name: itemRow.name || itemName,
        type: input.type,
        qty: input.qty,
        note: input.note || "",
        created_by: session.userId,
      })
      .select(MOVEMENT_SELECT)
      .single();

    if (movError || !movement) {
      return fail(movError?.message || "No se pudo registrar el movimiento");
    }

    return ok({
      item: {
        id: itemRow.id,
        name: itemRow.name || itemName,
        category: categoryName,
        kind: itemRow.kind || kind,
        subcategory: itemRow.subcategory || undefined,
        size: itemRow.size || undefined,
        stock: nextStock,
        reserved: Number(stockRow.reserved || 0),
        assigned: Number(stockRow.assigned ?? 0),
        unavailable: Number(stockRow.unavailable ?? 0),
        minStock: Number(stockRow.min_stock ?? minStock),
        location: itemRow.location || undefined,
        unit: itemRow.unit || undefined,
      },
      movement: movementsFromDb([movement])[0],
    });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
