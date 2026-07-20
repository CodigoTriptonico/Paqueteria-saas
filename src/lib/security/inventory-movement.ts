import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  InventoryMovementEvidence,
  InventoryMovementLocationType,
  InventoryMovementReasonCode,
  InventoryMovementReferenceType,
} from "@/lib/inventory-movement-audit";
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
  reasonCode?: InventoryMovementReasonCode;
  fromLocationType?: InventoryMovementLocationType | null;
  fromLocationId?: string | null;
  fromLocationLabel?: string;
  toLocationType?: InventoryMovementLocationType | null;
  toLocationId?: string | null;
  toLocationLabel?: string;
  referenceType?: InventoryMovementReferenceType | null;
  referenceId?: string | null;
  evidence?: InventoryMovementEvidence;
  assignmentId?: string | null;
  warehouseTransferId?: string | null;
  reversalOfMovementId?: string | null;
  movementKey?: string | null;
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
    p_reason_code: input.reasonCode || "unspecified",
    p_from_location_type: input.fromLocationType ?? null,
    p_from_location_id: input.fromLocationId ?? null,
    p_from_location_label: input.fromLocationLabel || "",
    p_to_location_type: input.toLocationType ?? null,
    p_to_location_id: input.toLocationId ?? null,
    p_to_location_label: input.toLocationLabel || "",
    p_reference_type: input.referenceType ?? null,
    p_reference_id: input.referenceId ?? null,
    p_evidence: input.evidence || {},
    p_assignment_id: input.assignmentId ?? null,
    p_warehouse_transfer_id: input.warehouseTransferId ?? null,
    p_reversal_of_movement_id: input.reversalOfMovementId ?? null,
    p_movement_key: input.movementKey ?? null,
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
