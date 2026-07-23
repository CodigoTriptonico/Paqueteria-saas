"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAppSession } from "@/lib/auth/session";
import { canAccessWarehouse, sessionHasPermission } from "@/lib/auth/permissions";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import type { WarehouseRow } from "@/lib/auth/types";
import {
  getConfiguredWarehouseLimit,
  type OrganizationSettings,
} from "@/lib/organizations/settings";

const WAREHOUSE_LIMIT_NOT_CONFIGURED =
  "Límite de bodegas no configurado en el plan. Contacte al administrador.";

async function loadConfiguredWarehouseLimit(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<number | null> {
  const { data: org } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", organizationId)
    .maybeSingle();

  return getConfiguredWarehouseLimit((org?.settings || {}) as OrganizationSettings);
}

async function copyWarehouseStockRows(
  supabase: SupabaseClient,
  organizationId: string,
  sourceWarehouseId: string,
  targetWarehouseId: string,
): Promise<number> {
  const { data: sourceStock, error: sourceError } = await supabase
    .from("inventory_stock")
    .select("item_id, min_stock")
    .eq("warehouse_id", sourceWarehouseId)
    .eq("organization_id", organizationId);

  if (sourceError) {
    throw new Error(sourceError.message);
  }

  const { data: targetStock } = await supabase
    .from("inventory_stock")
    .select("item_id")
    .eq("warehouse_id", targetWarehouseId)
    .eq("organization_id", organizationId);

  const existing = new Set((targetStock || []).map((row) => row.item_id));
  const toInsert = (sourceStock || [])
    .filter((row) => !existing.has(row.item_id))
    .map((row) => ({
      organization_id: organizationId,
      warehouse_id: targetWarehouseId,
      item_id: row.item_id,
      stock: 0,
      reserved: 0,
      min_stock: row.min_stock,
    }));

  if (!toInsert.length) {
    return 0;
  }

  const { error: insertError } = await supabase.from("inventory_stock").insert(toInsert);

  if (insertError) {
    throw new Error(insertError.message);
  }

  return toInsert.length;
}

async function seedNewWarehouseCatalog(
  supabase: SupabaseClient,
  organizationId: string,
  newWarehouseId: string,
) {
  const { data: sourceWarehouse } = await supabase
    .from("warehouses")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .neq("id", newWarehouseId)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sourceWarehouse?.id) {
    return 0;
  }

  return copyWarehouseStockRows(
    supabase,
    organizationId,
    sourceWarehouse.id,
    newWarehouseId,
  );
}

export async function listWarehousesAction(): Promise<ActionResult<WarehouseRow[]>> {
  try {
    const session = await requireAppSession();
    const supabase = await createScopedSupabase(session);

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

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data: existingWarehouses } = await supabase
      .from("warehouses")
      .select("id, is_active")
      .eq("organization_id", session.organizationId);

    const rows = existingWarehouses || [];
    const totalCount = rows.length;
    const activeCount = rows.filter((warehouse) => warehouse.is_active).length;
    const warehouseLimit = await loadConfiguredWarehouseLimit(
      supabase,
      session.organizationId,
    );

    if (warehouseLimit === null) {
      return fail(WAREHOUSE_LIMIT_NOT_CONFIGURED);
    }

    if (totalCount >= warehouseLimit) {
      return fail(
        `Límite de bodegas alcanzado (${warehouseLimit} en total). Contacte al administrador.`,
      );
    }

    const isFirstWarehouse = activeCount === 0;

    const { data, error } = await supabase
      .from("warehouses")
      .insert({
        organization_id: session.organizationId,
        name: input.name.trim(),
        code: input.code?.trim() || null,
        is_active: true,
        is_default: isFirstWarehouse,
      })
      .select("id, name, code, is_active, is_default")
      .single();

    if (error || !data) {
      return fail(error?.message || "No se pudo crear la bodega");
    }

    try {
      await seedNewWarehouseCatalog(supabase, session.organizationId, data.id);
    } catch (seedError) {
      return fail(actionErrorMessage(seedError));
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

    const supabase = await createScopedSupabase(session);
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

export async function reactivateWarehouseAction(
  warehouseId: string,
): Promise<ActionResult<null>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "warehouses.manage")) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data: warehouse } = await supabase
      .from("warehouses")
      .select("is_active")
      .eq("id", warehouseId)
      .eq("organization_id", session.organizationId)
      .maybeSingle();

    if (!warehouse) {
      return fail("Bodega no encontrada");
    }

    if (warehouse.is_active) {
      return ok(null);
    }

    const warehouseLimit = await loadConfiguredWarehouseLimit(
      supabase,
      session.organizationId,
    );

    if (warehouseLimit === null) {
      return fail(WAREHOUSE_LIMIT_NOT_CONFIGURED);
    }

    const { error } = await supabase
      .from("warehouses")
      .update({ is_active: true })
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

/** Recuerda la bodega activa del usuario para la próxima visita a Inventario. */
export async function rememberPreferredWarehouseAction(
  warehouseId: string,
): Promise<ActionResult<{ warehouseId: string }>> {
  try {
    const session = await requireAppSession();

    if (!canAccessWarehouse(session, warehouseId)) {
      return fail("No tienes acceso a esa bodega");
    }

    if (session.preferredWarehouseId === warehouseId) {
      return ok({ warehouseId });
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data: warehouse } = await supabase
      .from("warehouses")
      .select("id, is_active")
      .eq("id", warehouseId)
      .eq("organization_id", session.organizationId)
      .maybeSingle();

    if (!warehouse?.is_active) {
      return fail("Bodega no encontrada o inactiva");
    }

    const { error } = await supabase
      .from("profiles")
      .update({ default_warehouse_id: warehouseId })
      .eq("id", session.userId)
      .eq("organization_id", session.organizationId);

    if (error) {
      return fail(error.message);
    }

    return ok({ warehouseId });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
