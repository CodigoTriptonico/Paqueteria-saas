"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAppSession } from "@/lib/auth/session";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { canAccessWarehouse } from "@/lib/auth/permissions";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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
  resolveInventoryLeafItem,
  stockRowsToItems,
  type DbAssignmentRow,
  type DbCategory,
  type DbStockRow,
} from "@/lib/inventory-backend";
import type { InventoryAssignment, InventoryMovement } from "@/lib/inventory-types";
import type { InventoryStockItem } from "@/lib/inventory-stock";
import type { CategoryConfig } from "@/lib/inventory-tree";
import { InvalidQuantityError, readPositiveQty } from "@/lib/security/qty";
import { recordInventoryMovementAtomic } from "@/lib/security/inventory-movement";
import {
  ensureInventoryLeafState,
  inventoryLeafStateToItem,
} from "@/lib/inventory-leaf-state";
import {
  collectCategoryTreeLeaves,
  inventoryLeafKey,
  mergeOrphanItemsIntoCategoryConfigs,
  mergeTreeIntoInventoryItems,
} from "@/lib/inventory-stock";
import {
  buildInventoryItemPhotoPath,
  INVENTORY_ITEM_PHOTO_BUCKET,
  normalizeInventoryItemPhotoPath,
  resolveInventoryItemPhotoUrl,
  validateInventoryItemPhoto,
} from "@/lib/inventory-photos";
import {
  DEFAULT_INVENTORY_UNIT,
  normalizeInventoryUnit,
} from "@/lib/inventory-units";

export type WarehouseInventoryCorePayload = {
  categoryConfigs: CategoryConfig[];
  items: InventoryStockItem[];
};

export type WarehouseInventoryHistoryPayload = {
  movements: InventoryMovement[];
  assignments: InventoryAssignment[];
};


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
          "id, item_id, warehouse_id, stock, reserved, assigned, unavailable, min_stock, inventory_items(id, name, kind, subcategory, size, location, unit, photo_url, category_id, inventory_categories(name))",
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
  const admin = createSupabaseAdminClient();
  items = await Promise.all(
    items.map(async (item) => ({
      ...item,
      photoUrl: item.photoUrl
        ? await resolveInventoryItemPhotoUrl(admin, item.photoUrl)
        : undefined,
    })),
  );
  items = mergeTreeIntoInventoryItems(categoryConfigs, items);

  const syncedCategoryConfigs = mergeOrphanItemsIntoCategoryConfigs(
    categoryConfigs,
    items,
  );

  if (JSON.stringify(syncedCategoryConfigs) !== JSON.stringify(categoryConfigs)) {
    const categoryIdByName = new Map(
      ((categories || []) as DbCategory[]).map((row) => [row.name, row.id]),
    );

    for (const category of syncedCategoryConfigs) {
      const categoryId = categoryIdByName.get(category.name);

      if (!categoryId) {
        continue;
      }

      const { error: healError } = await supabase
        .from("inventory_categories")
        .update({ tree_data: category.items || [] })
        .eq("id", categoryId);

      if (healError) {
        return fail(healError.message);
      }
    }
  }

  return ok({ categoryConfigs: syncedCategoryConfigs, items });
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


async function saveInventoryCategoriesAction(
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

async function ensureLeafInCategoryTree(
  supabase: SupabaseClient,
  organizationId: string,
  categoryName: string,
  kind: string,
  subcategory: string | null,
) {
  const { data: categoryRow, error: categoryError } = await supabase
    .from("inventory_categories")
    .select("id, name, tree_data")
    .eq("organization_id", organizationId)
    .eq("name", categoryName)
    .maybeSingle();

  if (categoryError || !categoryRow) {
    return;
  }

  const categoryConfigs = categoriesToConfig([categoryRow as DbCategory]);
  const syncedCategoryConfigs = mergeOrphanItemsIntoCategoryConfigs(categoryConfigs, [
    {
      id: "sync",
      name: kind,
      category: categoryName,
      kind,
      subcategory: subcategory || undefined,
      stock: 0,
      reserved: 0,
      assigned: 0,
      unavailable: 0,
      minStock: 2,
    },
  ]);

  if (JSON.stringify(syncedCategoryConfigs) === JSON.stringify(categoryConfigs)) {
    return;
  }

  await supabase
    .from("inventory_categories")
    .update({ tree_data: syncedCategoryConfigs[0]?.items || [] })
    .eq("id", categoryRow.id);
}

async function pruneWarehouseItemsNotInTree(
  supabase: SupabaseClient,
  organizationId: string,
  warehouseId: string,
  categoryConfigs: CategoryConfig[],
) {
  const allowedKeys = new Set(
    categoryConfigs.flatMap((category) =>
      collectCategoryTreeLeaves(category).map((leaf) => inventoryLeafKey(leaf)),
    ),
  );

  const { data: stockRows, error: stockError } = await supabase
    .from("inventory_stock")
    .select(
      "id, item_id, stock, reserved, assigned, unavailable, inventory_items(id, kind, subcategory, inventory_categories(name))",
    )
    .eq("warehouse_id", warehouseId)
    .eq("organization_id", organizationId);

  if (stockError) {
    throw new Error(stockError.message);
  }

  for (const row of stockRows || []) {
    const itemRow = Array.isArray(row.inventory_items)
      ? row.inventory_items[0]
      : row.inventory_items;

    if (!itemRow) {
      continue;
    }

    const categoryRow = Array.isArray(itemRow.inventory_categories)
      ? itemRow.inventory_categories[0]
      : itemRow.inventory_categories;
    const key = inventoryLeafKey({
      category: categoryRow?.name || "",
      kind: itemRow.kind,
      subcategory: itemRow.subcategory || undefined,
    });

    if (allowedKeys.has(key)) {
      continue;
    }

    const stock = Number(row.stock ?? 0);
    const reserved = Number(row.reserved ?? 0);
    const assigned = Number(row.assigned ?? 0);
    const unavailable = Number(row.unavailable ?? 0);

    if (stock !== 0 || reserved !== 0 || assigned !== 0 || unavailable !== 0) {
      continue;
    }

    const [{ count: movementCount, error: movementError }, { count: assignmentCount, error: assignmentError }] =
      await Promise.all([
        supabase
          .from("inventory_movements")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .eq("item_id", row.item_id),
        supabase
          .from("inventory_assignments")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .eq("item_id", row.item_id),
      ]);

    if (movementError) {
      throw new Error(movementError.message);
    }

    if (assignmentError) {
      throw new Error(assignmentError.message);
    }

    if ((movementCount || 0) > 0 || (assignmentCount || 0) > 0) {
      continue;
    }

    const { count: remainingStockCount, error: remainingStockError } = await supabase
      .from("inventory_stock")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("item_id", row.item_id)
      .neq("id", row.id);

    if (remainingStockError) {
      throw new Error(remainingStockError.message);
    }

    await supabase.from("inventory_stock").delete().eq("id", row.id);

    if ((remainingStockCount || 0) === 0) {
      await supabase
        .from("inventory_items")
        .delete()
        .eq("organization_id", organizationId)
        .eq("id", row.item_id);
    }
  }
}

async function saveWarehouseInventoryState(
  supabase: SupabaseClient,
  organizationId: string,
  warehouseId: string,
  categoryConfigs: CategoryConfig[],
  items: InventoryStockItem[],
  createdBy: string,
  options?: { persistCategories?: boolean },
) {
  const syncedCategoryConfigs = mergeOrphanItemsIntoCategoryConfigs(
    categoryConfigs,
    items,
  );

  if (options?.persistCategories !== false) {
    const categoriesResult = await saveInventoryCategoriesAction(syncedCategoryConfigs);

    if (!categoriesResult.ok) {
      throw new Error(categoriesResult.error);
    }
  }

  await ensureItemsForWarehouse(
    supabase,
    organizationId,
    warehouseId,
    syncedCategoryConfigs,
    items,
    createdBy,
  );

  if (options?.persistCategories !== false) {
    await pruneWarehouseItemsNotInTree(
      supabase,
      organizationId,
      warehouseId,
      syncedCategoryConfigs,
    );
  }
}

async function ensureItemsForWarehouse(
  supabase: SupabaseClient,
  organizationId: string,
  warehouseId: string,
  categoryConfigs: CategoryConfig[],
  items: InventoryStockItem[],
  createdBy: string,
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
    const stockItem = items.find((item) => item.id === match?.id) || match;

    if (!itemId || itemId.startsWith("inv-") || itemId.startsWith("virtual-")) {
      const { data: existingItem, error: existingItemError } =
        await resolveInventoryLeafItem(supabase, {
          organizationId,
          categoryId: leaf.categoryId,
          kind: leaf.kind,
          subcategory: leaf.subcategory || null,
          warehouseId,
        });

      if (existingItemError) {
        throw new Error(existingItemError);
      }

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
            unit: normalizeInventoryUnit(stockItem?.unit) || DEFAULT_INVENTORY_UNIT,
            photo_url: stockItem?.photoUrl
              ? normalizeInventoryItemPhotoPath(stockItem.photoUrl)
              : "",
          })
          .select("id")
          .single();

        if (error || !inserted) {
          throw new Error(error?.message || "No se pudo crear item");
        }

        itemId = inserted.id;
      }
    }

    if (!itemId) {
      throw new Error("No se pudo resolver item de inventario");
    }

    const photoPath = stockItem?.photoUrl
      ? normalizeInventoryItemPhotoPath(stockItem.photoUrl)
      : "";
    const unit = normalizeInventoryUnit(stockItem?.unit) || DEFAULT_INVENTORY_UNIT;
    const itemUpdates: { photo_url?: string; unit: string } = { unit };

    if (photoPath) {
      itemUpdates.photo_url = photoPath;
    }

    const { error: itemUpdateError } = await supabase
      .from("inventory_items")
      .update(itemUpdates)
      .eq("id", itemId)
      .eq("organization_id", organizationId);

    if (itemUpdateError) {
      throw new Error(itemUpdateError.message);
    }

    const { data: stockRow } = await supabase
      .from("inventory_stock")
      .select("id, stock")
      .eq("warehouse_id", warehouseId)
      .eq("item_id", itemId)
      .maybeSingle();

    const desiredStock = Math.max(Number(stockItem?.stock ?? 0) || 0, 0);
    const currentStock = Number(stockRow?.stock ?? 0) || 0;
    const stockPayload = {
      organization_id: organizationId,
      warehouse_id: warehouseId,
      item_id: itemId,
      stock: 0,
      reserved: stockItem?.reserved ?? 0,
      min_stock: stockItem?.minStock ?? 2,
    };

    if (stockRow?.id) {
      await supabase
        .from("inventory_stock")
        .update({
          reserved: stockPayload.reserved,
          min_stock: stockPayload.min_stock,
        })
        .eq("id", stockRow.id);
    } else {
      await supabase.from("inventory_stock").insert(stockPayload);
    }

    if (desiredStock !== currentStock) {
      const movementType = desiredStock > 0 ? "ajuste" : "salida";
      const movementQty = desiredStock > 0 ? desiredStock : currentStock;

      if (movementQty > 0) {
        await recordInventoryMovementAtomic(supabase, {
          organizationId,
          warehouseId,
          itemId,
          itemName: stockItem?.name || leaf.name,
          type: movementType,
          qty: movementQty,
          note: `Ajuste manual de inventario - ${stockItem?.name || leaf.name}`,
          createdBy,
        });
      }
    }
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

    await saveWarehouseInventoryState(
      supabase,
      session.organizationId,
      input.warehouseId,
      input.categoryConfigs,
      input.items,
      session.userId,
    );

    return ok(null);
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

    const leafResult = await ensureInventoryLeafState(
      supabase,
      session.organizationId,
      input,
    );

    if (!leafResult.ok) {
      return fail(leafResult.error);
    }

    const leafState = leafResult.data;
    const { categoryName, kind, subcategory } = leafState;
    await ensureLeafInCategoryTree(
      supabase,
      session.organizationId,
      categoryName,
      kind,
      subcategory,
    );

    return ok(inventoryLeafStateToItem(leafState));
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

    const leafResult = await ensureInventoryLeafState(
      supabase,
      session.organizationId,
      input,
    );

    if (!leafResult.ok) {
      return fail(leafResult.error);
    }

    const leafState = leafResult.data;
    const { itemName, itemRow } = leafState;

    const qty = readPositiveQty(input.qty);

    const result = await recordInventoryMovementAtomic(supabase, {
      organizationId: session.organizationId,
      warehouseId: input.warehouseId,
      itemId: itemRow.id,
      itemName: itemRow.name || itemName,
      type: input.type,
      qty,
      note: input.note,
      createdBy: session.userId,
    });

    const { data: movement, error: movError } = await supabase
      .from("inventory_movements")
      .select(MOVEMENT_SELECT)
      .eq("id", result.movementId)
      .single();

    if (movError || !movement) {
      return fail(movError?.message || "No se pudo registrar el movimiento");
    }

    return ok({
      item: inventoryLeafStateToItem(leafState, result.stock),
      movement: movementsFromDb([movement])[0],
    });
  } catch (error) {
    if (error instanceof InvalidQuantityError) {
      return fail(error.message);
    }
    return fail(actionErrorMessage(error));
  }
}

function isPersistedInventoryItemId(itemId: string) {
  return Boolean(itemId) && !itemId.startsWith("inv-") && !itemId.startsWith("virtual-");
}

export async function uploadInventoryItemPhotoAction(
  formData: FormData,
): Promise<ActionResult<{ path: string; previewUrl: string }>> {
  try {
    const session = await requireAppSession();

    if (
      !sessionHasPermission(session, "inventory.adjust") &&
      !sessionHasPermission(session, "sales.manage")
    ) {
      return fail("Sin permiso para actualizar inventario");
    }

    const admin = createSupabaseAdminClient();

    if (!admin) {
      return fail("Supabase no configurado");
    }

    const file = formData.get("photo");

    if (!(file instanceof File) || !file.name) {
      return fail("Foto requerida");
    }

    const validation = validateInventoryItemPhoto(file);

    if (!validation.ok) {
      return fail(validation.error);
    }

    const path = buildInventoryItemPhotoPath(session.organizationId, file.name);
    const { error } = await admin.storage.from(INVENTORY_ITEM_PHOTO_BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

    if (error) {
      return fail(error.message);
    }

    const previewUrl = await resolveInventoryItemPhotoUrl(admin, path);
    const itemId = String(formData.get("itemId") || "").trim();

    if (isPersistedInventoryItemId(itemId)) {
      const { error: updateError } = await admin
        .from("inventory_items")
        .update({ photo_url: path })
        .eq("id", itemId)
        .eq("organization_id", session.organizationId);

      if (updateError) {
        return fail(updateError.message);
      }
    }

    return ok({ path, previewUrl });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function clearInventoryItemPhotoAction(
  itemId: string,
): Promise<ActionResult<null>> {
  try {
    const session = await requireAppSession();

    if (
      !sessionHasPermission(session, "inventory.adjust") &&
      !sessionHasPermission(session, "sales.manage")
    ) {
      return fail("Sin permiso para actualizar inventario");
    }

    if (!isPersistedInventoryItemId(itemId)) {
      return ok(null);
    }

    const admin = createSupabaseAdminClient();

    if (!admin) {
      return fail("Supabase no configurado");
    }

    const { error } = await admin
      .from("inventory_items")
      .update({ photo_url: "" })
      .eq("id", itemId)
      .eq("organization_id", session.organizationId);

    if (error) {
      return fail(error.message);
    }

    return ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function updateInventoryItemUnitAction(input: {
  itemId: string;
  unit: string;
  warehouseId?: string;
  category?: string;
  kind?: string;
  subcategory?: string;
  itemName?: string;
}): Promise<ActionResult<{ unit: string; itemId: string }>> {
  try {
    const session = await requireAppSession();

    if (
      !sessionHasPermission(session, "inventory.adjust") &&
      !sessionHasPermission(session, "sales.manage")
    ) {
      return fail("Sin permiso para actualizar inventario");
    }

    const unit = normalizeInventoryUnit(input.unit);

    if (!unit) {
      return fail("Unidad de medida requerida");
    }

    const supabase = await createScopedSupabase(session);

    if (!supabase) {
      return fail("Supabase no configurado");
    }

    let itemId = input.itemId.trim();

    if (!isPersistedInventoryItemId(itemId)) {
      if (
        !input.warehouseId ||
        !input.category?.trim() ||
        !input.kind?.trim()
      ) {
        return ok({ unit, itemId });
      }

      const leafResult = await ensureInventoryLeafState(
        supabase,
        session.organizationId,
        {
          warehouseId: input.warehouseId,
          category: input.category,
          kind: input.kind,
          subcategory: input.subcategory,
          itemName: input.itemName || input.kind,
        },
      );

      if (!leafResult.ok) {
        return fail(leafResult.error);
      }

      itemId = leafResult.data.itemRow.id;
    }

    const { error } = await supabase
      .from("inventory_items")
      .update({ unit })
      .eq("id", itemId)
      .eq("organization_id", session.organizationId);

    if (error) {
      return fail(error.message);
    }

    return ok({ unit, itemId });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
