"use server";

import { requireAppSession } from "@/lib/auth/session";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { createScopedSupabase as loadScopedSupabase } from "@/lib/supabase/scoped";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import {
  buildWarehouseBinCode,
  buildWarehouseBinLabel,
  validateBinPlacementQuantity,
  type InventoryBinPlacement,
  type WarehouseBin,
} from "@/lib/inventory-bins";

async function createScopedSupabase(
  session: Awaited<ReturnType<typeof requireAppSession>>,
) {
  const supabase = await loadScopedSupabase(session);
  if (!supabase) throw new Error("Supabase no configurado");
  return supabase;
}

type WarehouseBinRow = {
  id: string;
  warehouse_id: string;
  zone: string;
  aisle: string;
  shelf: string;
  code: string;
  label: string;
  is_active: boolean;
  sort_order: number;
};

type InventoryBinStockRow = {
  bin_id: string;
  item_id: string;
  quantity: number;
  warehouse_bins: {
    code: string;
    label: string;
  } | { code: string; label: string }[] | null;
};

function mapWarehouseBin(row: WarehouseBinRow): WarehouseBin {
  return {
    id: row.id,
    warehouseId: row.warehouse_id,
    zone: row.zone,
    aisle: row.aisle,
    shelf: row.shelf,
    code: row.code,
    label: row.label,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
}

function mapPlacement(row: InventoryBinStockRow): InventoryBinPlacement {
  const bin = Array.isArray(row.warehouse_bins) ? row.warehouse_bins[0] : row.warehouse_bins;
  return {
    binId: row.bin_id,
    binCode: bin?.code || "—",
    binLabel: bin?.label || "—",
    quantity: Number(row.quantity),
  };
}

export async function listWarehouseBinsAction(input: {
  warehouseId: string;
  includeInactive?: boolean;
}): Promise<ActionResult<WarehouseBin[]>> {
  try {
    const session = await requireAppSession();
    if (!session) {
      return fail("Sesión requerida");
    }

    if (!sessionHasPermission(session, "inventory.view")) {
      return fail("Sin permiso para ver inventario");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }
    let query = supabase
      .from("warehouse_bins")
      .select("id, warehouse_id, zone, aisle, shelf, code, label, is_active, sort_order")
      .eq("warehouse_id", input.warehouseId)
      .order("sort_order", { ascending: true })
      .order("code", { ascending: true });

    if (!input.includeInactive) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    if (error) {
      return fail(error.message);
    }

    return ok((data || []).map((row) => mapWarehouseBin(row as WarehouseBinRow)));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function saveWarehouseBinAction(input: {
  warehouseId: string;
  binId?: string;
  zone: string;
  aisle?: string;
  shelf?: string;
  code?: string;
  label?: string;
  sortOrder?: number;
}): Promise<ActionResult<WarehouseBin>> {
  try {
    const session = await requireAppSession();
    if (!session) {
      return fail("Sesión requerida");
    }

    const canManage =
      sessionHasPermission(session, "warehouses.manage") ||
      sessionHasPermission(session, "inventory.adjust");

    if (!canManage) {
      return fail("Sin permiso para administrar estantes");
    }

    const code = buildWarehouseBinCode({
      zone: input.zone,
      aisle: input.aisle || "",
      shelf: input.shelf || "",
      code: input.code,
    });

    if (!code) {
      return fail("Indica al menos zona, pasillo, estante o código");
    }

    const label = buildWarehouseBinLabel({
      zone: input.zone,
      aisle: input.aisle || "",
      shelf: input.shelf || "",
      label: input.label,
      code,
    });

    const supabase = await createScopedSupabase(session);
    const payload = {
      organization_id: session.organizationId,
      warehouse_id: input.warehouseId,
      zone: input.zone.trim(),
      aisle: (input.aisle || "").trim(),
      shelf: (input.shelf || "").trim(),
      code,
      label,
      sort_order: input.sortOrder ?? 0,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    if (input.binId) {
      const { data, error } = await supabase
        .from("warehouse_bins")
        .update(payload)
        .eq("id", input.binId)
        .eq("warehouse_id", input.warehouseId)
        .select("id, warehouse_id, zone, aisle, shelf, code, label, is_active, sort_order")
        .single();

      if (error || !data) {
        return fail(error?.message || "No se pudo actualizar el estante");
      }

      return ok(mapWarehouseBin(data as WarehouseBinRow));
    }

    const { data, error } = await supabase
      .from("warehouse_bins")
      .insert(payload)
      .select("id, warehouse_id, zone, aisle, shelf, code, label, is_active, sort_order")
      .single();

    if (error || !data) {
      return fail(error?.message || "No se pudo crear el estante");
    }

    return ok(mapWarehouseBin(data as WarehouseBinRow));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function deactivateWarehouseBinAction(input: {
  warehouseId: string;
  binId: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireAppSession();
    if (!session) {
      return fail("Sesión requerida");
    }

    const canManage =
      sessionHasPermission(session, "warehouses.manage") ||
      sessionHasPermission(session, "inventory.adjust");

    if (!canManage) {
      return fail("Sin permiso para administrar estantes");
    }

    const supabase = await createScopedSupabase(session);
    const { error } = await supabase
      .from("warehouse_bins")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.binId)
      .eq("warehouse_id", input.warehouseId);

    if (error) {
      return fail(error.message);
    }

    return ok({ id: input.binId });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function listInventoryBinPlacementsAction(input: {
  warehouseId: string;
  itemId: string;
}): Promise<ActionResult<InventoryBinPlacement[]>> {
  try {
    const session = await requireAppSession();
    if (!session) {
      return fail("Sesión requerida");
    }

    if (!sessionHasPermission(session, "inventory.view")) {
      return fail("Sin permiso para ver inventario");
    }

    const supabase = await createScopedSupabase(session);
    const { data, error } = await supabase
      .from("inventory_bin_stock")
      .select("bin_id, item_id, quantity, warehouse_bins(code, label)")
      .eq("warehouse_id", input.warehouseId)
      .eq("item_id", input.itemId)
      .gt("quantity", 0)
      .order("quantity", { ascending: false });

    if (error) {
      return fail(error.message);
    }

    return ok((data || []).map((row) => mapPlacement(row as InventoryBinStockRow)));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function setInventoryBinPlacementAction(input: {
  warehouseId: string;
  itemId: string;
  binId: string;
  quantity: number;
}): Promise<ActionResult<InventoryBinPlacement[]>> {
  try {
    const session = await requireAppSession();
    if (!session) {
      return fail("Sesión requerida");
    }

    if (!sessionHasPermission(session, "inventory.adjust")) {
      return fail("Sin permiso para ajustar inventario");
    }

    const supabase = await createScopedSupabase(session);

    const [{ data: stockRow, error: stockError }, { data: placementRows, error: placementError }] =
      await Promise.all([
        supabase
          .from("inventory_stock")
          .select("stock")
          .eq("warehouse_id", input.warehouseId)
          .eq("item_id", input.itemId)
          .maybeSingle(),
        supabase
          .from("inventory_bin_stock")
          .select("bin_id, item_id, quantity, warehouse_bins(code, label)")
          .eq("warehouse_id", input.warehouseId)
          .eq("item_id", input.itemId),
      ]);

    if (stockError) {
      return fail(stockError.message);
    }

    if (placementError) {
      return fail(placementError.message);
    }

    const warehouseStock = Number(stockRow?.stock || 0);
    const placements = (placementRows || []).map((row) => mapPlacement(row as InventoryBinStockRow));
    const validation = validateBinPlacementQuantity({
      warehouseStock,
      placements,
      binId: input.binId,
      nextQuantity: input.quantity,
    });

    if (!validation.ok) {
      return fail(validation.error);
    }

    if (validation.quantity <= 0) {
      const { error: deleteError } = await supabase
        .from("inventory_bin_stock")
        .delete()
        .eq("warehouse_id", input.warehouseId)
        .eq("item_id", input.itemId)
        .eq("bin_id", input.binId);

      if (deleteError) {
        return fail(deleteError.message);
      }
    } else {
      const { error: upsertError } = await supabase.from("inventory_bin_stock").upsert(
        {
          organization_id: session.organizationId,
          warehouse_id: input.warehouseId,
          bin_id: input.binId,
          item_id: input.itemId,
          quantity: validation.quantity,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "bin_id,item_id" },
      );

      if (upsertError) {
        return fail(upsertError.message);
      }
    }

    return listInventoryBinPlacementsAction({
      warehouseId: input.warehouseId,
      itemId: input.itemId,
    });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function transferInventoryBinStockAction(input: {
  warehouseId: string;
  itemId: string;
  fromBinId: string;
  toBinId: string;
  quantity: number;
}): Promise<ActionResult<InventoryBinPlacement[]>> {
  try {
    const qty = Math.max(0, input.quantity);

    if (!qty) {
      return fail("Indica una cantidad mayor a cero");
    }

    if (input.fromBinId === input.toBinId) {
      return fail("Origen y destino deben ser distintos");
    }

    const session = await requireAppSession();
    if (!session) {
      return fail("Sesión requerida");
    }

    if (!sessionHasPermission(session, "inventory.adjust")) {
      return fail("Sin permiso para ajustar inventario");
    }

    const current = await listInventoryBinPlacementsAction({
      warehouseId: input.warehouseId,
      itemId: input.itemId,
    });

    if (!current.ok) {
      return current;
    }

    const fromPlacement = current.data.find((row) => row.binId === input.fromBinId);

    if (!fromPlacement || fromPlacement.quantity < qty) {
      return fail("No hay suficiente stock en el estante de origen");
    }

    const nextFromQty = fromPlacement.quantity - qty;
    const toPlacement = current.data.find((row) => row.binId === input.toBinId);
    const nextToQty = (toPlacement?.quantity || 0) + qty;

    const fromResult = await setInventoryBinPlacementAction({
      warehouseId: input.warehouseId,
      itemId: input.itemId,
      binId: input.fromBinId,
      quantity: nextFromQty,
    });

    if (!fromResult.ok) {
      return fromResult;
    }

    return setInventoryBinPlacementAction({
      warehouseId: input.warehouseId,
      itemId: input.itemId,
      binId: input.toBinId,
      quantity: nextToQty,
    });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
