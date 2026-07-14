import type { SupabaseClient } from "@supabase/supabase-js";
import { readPositiveQty } from "@/lib/security/qty";

type InventoryMovementType = "entrada" | "salida" | "ajuste" | "devolucion";

export type RecordInventoryMovementInput = {
  organizationId: string;
  warehouseId: string;
  itemId: string;
  itemName: string;
  type: InventoryMovementType;
  qty: number | string;
  note?: string;
  createdBy: string | null;
  assigneeId?: string | null;
};

export type RecordInventoryMovementResult = {
  movementId: string;
  stock: number;
};

export async function recordInventoryMovementAtomic(
  supabase: SupabaseClient,
  input: RecordInventoryMovementInput,
): Promise<RecordInventoryMovementResult> {
  const qty = readPositiveQty(input.qty);

  const { data, error } = await supabase.rpc("record_inventory_movement_atomic", {
    target_org_id: input.organizationId,
    p_warehouse_id: input.warehouseId,
    p_item_id: input.itemId,
    p_item_name: input.itemName,
    p_type: input.type,
    p_qty: qty,
    p_note: input.note || "",
    p_created_by: input.createdBy,
    p_assignee_id: input.assigneeId ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  const payload = (data || {}) as { movement_id?: string; stock?: number };

  if (!payload.movement_id) {
    throw new Error("No se pudo registrar el movimiento");
  }

  return {
    movementId: payload.movement_id,
    stock: Number(payload.stock) || 0,
  };
}
