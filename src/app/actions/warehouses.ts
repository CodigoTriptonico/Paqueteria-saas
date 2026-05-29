"use server";

import { requireAppSession } from "@/lib/auth/session";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import type { WarehouseRow } from "@/lib/auth/types";

export async function listWarehousesAction(): Promise<ActionResult<WarehouseRow[]>> {
  try {
    const session = await requireAppSession();
    const supabase = await createSupabaseServerClient();

    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data, error } = await supabase
      .from("warehouses")
      .select("id, name, code, is_active, is_default")
      .eq("organization_id", session.organizationId)
      .order("created_at");

    if (error) {
      return fail(error.message);
    }

    return ok((data || []) as WarehouseRow[]);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function createWarehouseAction(input: {
  name: string;
  code?: string;
}): Promise<ActionResult<WarehouseRow>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "warehouses.manage")) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data, error } = await supabase
      .from("warehouses")
      .insert({
        organization_id: session.organizationId,
        name: input.name.trim(),
        code: input.code?.trim() || null,
        is_active: true,
        is_default: false,
      })
      .select("id, name, code, is_active, is_default")
      .single();

    if (error || !data) {
      return fail(error?.message || "No se pudo crear la bodega");
    }

    return ok(data as WarehouseRow);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function deactivateWarehouseAction(warehouseId: string): Promise<ActionResult<null>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "warehouses.manage")) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data: warehouse } = await supabase
      .from("warehouses")
      .select("is_default")
      .eq("id", warehouseId)
      .eq("organization_id", session.organizationId)
      .maybeSingle();

    if (!warehouse) {
      return fail("Bodega no encontrada");
    }

    if (warehouse.is_default) {
      return fail("No puedes desactivar la bodega principal");
    }

    const { error } = await supabase
      .from("warehouses")
      .update({ is_active: false })
      .eq("id", warehouseId)
      .eq("organization_id", session.organizationId);

    if (error) {
      return fail(error.message);
    }

    return ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function copyWarehouseCatalogAction(
  sourceWarehouseId: string,
  targetWarehouseId: string,
): Promise<ActionResult<{ copied: number }>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "warehouses.manage")) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data: sourceStock, error: sourceError } = await supabase
      .from("inventory_stock")
      .select("item_id, min_stock")
      .eq("warehouse_id", sourceWarehouseId)
      .eq("organization_id", session.organizationId);

    if (sourceError) {
      return fail(sourceError.message);
    }

    const { data: targetStock } = await supabase
      .from("inventory_stock")
      .select("item_id")
      .eq("warehouse_id", targetWarehouseId);

    const existing = new Set((targetStock || []).map((row) => row.item_id));
    const toInsert = (sourceStock || [])
      .filter((row) => !existing.has(row.item_id))
      .map((row) => ({
        organization_id: session.organizationId,
        warehouse_id: targetWarehouseId,
        item_id: row.item_id,
        stock: 0,
        reserved: 0,
        min_stock: row.min_stock,
      }));

    if (!toInsert.length) {
      return ok({ copied: 0 });
    }

    const { error: insertError } = await supabase.from("inventory_stock").insert(toInsert);

    if (insertError) {
      return fail(insertError.message);
    }

    return ok({ copied: toInsert.length });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
