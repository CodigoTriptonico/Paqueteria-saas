"use server";

import { requireAppSession } from "@/lib/auth/session";
import { canAccessWarehouse, sessionHasPermission } from "@/lib/auth/permissions";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import {
  actionErrorMessage,
  fail,
  ok,
  type ActionResult,
} from "@/lib/actions/errors";
import type {
  InventoryWarehouseTransfer,
  InventoryWarehouseTransferStatus,
} from "@/lib/inventory-warehouse-transfers";

type ProfileJoin = { full_name: string | null; email: string } | null;

type DbTransferRow = {
  id: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  item_id: string;
  item_name: string;
  qty: number;
  status: InventoryWarehouseTransferStatus;
  note: string;
  outbound_movement_id: string | null;
  inbound_movement_id: string | null;
  created_by: string | null;
  created_at: string;
  received_by: string | null;
  received_at: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  created_by_profile?: ProfileJoin | ProfileJoin[];
  received_by_profile?: ProfileJoin | ProfileJoin[];
  cancelled_by_profile?: ProfileJoin | ProfileJoin[];
};

const TRANSFER_SELECT = `
  id,
  from_warehouse_id,
  to_warehouse_id,
  item_id,
  item_name,
  qty,
  status,
  note,
  outbound_movement_id,
  inbound_movement_id,
  created_by,
  created_at,
  received_by,
  received_at,
  cancelled_by,
  cancelled_at,
  created_by_profile:profiles!inventory_warehouse_transfers_created_by_fkey(full_name, email),
  received_by_profile:profiles!inventory_warehouse_transfers_received_by_fkey(full_name, email),
  cancelled_by_profile:profiles!inventory_warehouse_transfers_cancelled_by_fkey(full_name, email)
`;

function readProfileName(profile?: ProfileJoin | ProfileJoin[] | null) {
  const row = Array.isArray(profile) ? profile[0] : profile;
  return row?.full_name?.trim() || row?.email || null;
}

function transfersFromDb(
  rows: DbTransferRow[],
  warehouseNames: Map<string, string>,
): InventoryWarehouseTransfer[] {
  return rows.map((row) => ({
    id: row.id,
    fromWarehouseId: row.from_warehouse_id,
    fromWarehouseName: warehouseNames.get(row.from_warehouse_id) || "Bodega origen",
    toWarehouseId: row.to_warehouse_id,
    toWarehouseName: warehouseNames.get(row.to_warehouse_id) || "Bodega destino",
    itemId: row.item_id,
    itemName: row.item_name,
    qty: Number(row.qty) || 0,
    status: row.status,
    note: row.note || "",
    outboundMovementId: row.outbound_movement_id,
    inboundMovementId: row.inbound_movement_id,
    createdBy: row.created_by,
    createdByName: readProfileName(row.created_by_profile),
    createdAt: row.created_at,
    receivedBy: row.received_by,
    receivedByName: readProfileName(row.received_by_profile),
    receivedAt: row.received_at,
    cancelledBy: row.cancelled_by,
    cancelledByName: readProfileName(row.cancelled_by_profile),
    cancelledAt: row.cancelled_at,
  }));
}

export async function listInventoryWarehouseTransfersAction(input: {
  warehouseId: string;
  status?: InventoryWarehouseTransferStatus;
  limit?: number;
}): Promise<ActionResult<InventoryWarehouseTransfer[]>> {
  try {
    const session = await requireAppSession();
    if (!session) {
      return fail("Sesión requerida");
    }

    if (!sessionHasPermission(session, "inventory.view")) {
      return fail("Sin permiso para ver inventario");
    }

    if (!canAccessWarehouse(session, input.warehouseId)) {
      return fail("Sin acceso a la bodega");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    let query = supabase
      .from("inventory_warehouse_transfers")
      .select(TRANSFER_SELECT)
      .eq("organization_id", session.organizationId)
      .or(
        `from_warehouse_id.eq.${input.warehouseId},to_warehouse_id.eq.${input.warehouseId}`,
      )
      .order("created_at", { ascending: false })
      .limit(input.limit ?? 100);

    if (input.status) {
      query = query.eq("status", input.status);
    }

    const { data, error } = await query;

    if (error) {
      return fail(error.message);
    }

    const rows = (data || []) as DbTransferRow[];

    if (!rows.length) {
      return ok([]);
    }

    const warehouseIds = [
      ...new Set(rows.flatMap((row) => [row.from_warehouse_id, row.to_warehouse_id])),
    ];
    const { data: warehouseRows, error: warehouseError } = await supabase
      .from("warehouses")
      .select("id, name")
      .in("id", warehouseIds);

    if (warehouseError) {
      return fail(warehouseError.message);
    }

    const warehouseNames = new Map(
      (warehouseRows || []).map((row) => [row.id as string, row.name as string]),
    );

    return ok(transfersFromDb(rows, warehouseNames));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function createInventoryWarehouseTransferAction(input: {
  fromWarehouseId: string;
  toWarehouseId: string;
  itemId: string;
  qty: number;
  note?: string;
}): Promise<ActionResult<InventoryWarehouseTransfer>> {
  try {
    const session = await requireAppSession();
    if (!session) {
      return fail("Sesión requerida");
    }

    if (!sessionHasPermission(session, "inventory.adjust")) {
      return fail("Sin permiso para transferir inventario");
    }

    if (!canAccessWarehouse(session, input.fromWarehouseId)) {
      return fail("Sin acceso a la bodega de origen");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data, error } = await supabase.rpc("create_inventory_warehouse_transfer", {
      target_org_id: session.organizationId,
      p_from_warehouse_id: input.fromWarehouseId,
      p_to_warehouse_id: input.toWarehouseId,
      p_item_id: input.itemId,
      p_qty: input.qty,
      p_note: input.note || "",
    });

    if (error) {
      return fail(error.message);
    }

    const transferId = (data as { transfer_id?: string } | null)?.transfer_id;

    if (!transferId) {
      return fail("No se pudo crear la transferencia");
    }

    const listed = await listInventoryWarehouseTransfersAction({
      warehouseId: input.fromWarehouseId,
      limit: 1,
    });

    if (!listed.ok) {
      return fail(listed.error);
    }

    const created = listed.data.find((transfer) => transfer.id === transferId);

    if (!created) {
      return fail("Transferencia creada pero no visible");
    }

    return ok(created);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function receiveInventoryWarehouseTransferAction(input: {
  transferId: string;
  warehouseId: string;
}): Promise<ActionResult<InventoryWarehouseTransfer>> {
  try {
    const session = await requireAppSession();
    if (!session) {
      return fail("Sesión requerida");
    }

    if (!sessionHasPermission(session, "inventory.adjust")) {
      return fail("Sin permiso para recibir inventario");
    }

    if (!canAccessWarehouse(session, input.warehouseId)) {
      return fail("Sin acceso a la bodega");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { error } = await supabase.rpc("receive_inventory_warehouse_transfer", {
      target_org_id: session.organizationId,
      p_transfer_id: input.transferId,
    });

    if (error) {
      return fail(error.message);
    }

    const listed = await listInventoryWarehouseTransfersAction({
      warehouseId: input.warehouseId,
      limit: 100,
    });

    if (!listed.ok) {
      return fail(listed.error);
    }

    const received = listed.data.find((transfer) => transfer.id === input.transferId);

    if (!received) {
      return fail("Transferencia recibida pero no visible");
    }

    return ok(received);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function cancelInventoryWarehouseTransferAction(input: {
  transferId: string;
  warehouseId: string;
}): Promise<ActionResult<InventoryWarehouseTransfer>> {
  try {
    const session = await requireAppSession();
    if (!session) {
      return fail("Sesión requerida");
    }

    if (!sessionHasPermission(session, "inventory.adjust")) {
      return fail("Sin permiso para cancelar transferencias");
    }

    if (!canAccessWarehouse(session, input.warehouseId)) {
      return fail("Sin acceso a la bodega");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { error } = await supabase.rpc("cancel_inventory_warehouse_transfer", {
      target_org_id: session.organizationId,
      p_transfer_id: input.transferId,
    });

    if (error) {
      return fail(error.message);
    }

    const listed = await listInventoryWarehouseTransfersAction({
      warehouseId: input.warehouseId,
      limit: 100,
    });

    if (!listed.ok) {
      return fail(listed.error);
    }

    const cancelled = listed.data.find((transfer) => transfer.id === input.transferId);

    if (!cancelled) {
      return fail("Transferencia cancelada pero no visible");
    }

    return ok(cancelled);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
