import type { SupabaseClient } from "@supabase/supabase-js";
import { readPositiveQty } from "@/lib/security/qty";

export async function reserveInventorySaleStock(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    shipmentId: string;
    warehouseId: string;
    itemId: string;
    itemName: string;
    qty: number | string;
    createdBy: string | null;
  },
) {
  const qty = readPositiveQty(input.qty);

  const { data, error } = await supabase.rpc("reserve_inventory_sale_stock", {
    target_org_id: input.organizationId,
    p_shipment_id: input.shipmentId,
    p_warehouse_id: input.warehouseId,
    p_item_id: input.itemId,
    p_item_name: input.itemName,
    p_qty: qty,
    p_created_by: input.createdBy,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data || {}) as { reservation_id?: string; reserved?: number; available?: number };
}

export async function fulfillInventorySaleStock(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    shipmentId: string;
    note: string;
    createdBy: string | null;
    assigneeId?: string | null;
  },
) {
  const { data, error } = await supabase.rpc("fulfill_inventory_sale_stock", {
    target_org_id: input.organizationId,
    p_shipment_id: input.shipmentId,
    p_note: input.note,
    p_created_by: input.createdBy,
    p_assignee_id: input.assigneeId ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data || {}) as { fulfilled_count?: number };
}

export async function releaseInventorySaleStock(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    shipmentId: string;
  },
) {
  const { data, error } = await supabase.rpc("release_inventory_sale_stock", {
    target_org_id: input.organizationId,
    p_shipment_id: input.shipmentId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data || {}) as { released_count?: number };
}
