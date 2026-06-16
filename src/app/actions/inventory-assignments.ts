"use server";

import { ensureInventoryLeafItemAction } from "@/app/actions/inventory";
import { requireAppSession } from "@/lib/auth/session";
import { canAccessWarehouse, sessionHasPermission } from "@/lib/auth/permissions";
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
  inventoryStockJoinToItem,
  MOVEMENT_SELECT,
  movementsFromDb,
  type DbAssignmentRow,
  type DbMovementRow,
  type DbStockJoinRow,
} from "@/lib/inventory-backend";
import type {
  InventoryAssignment,
  InventoryAssignmentFilters,
  InventoryAssignmentOutcome,
  InventoryMovement,
  InventoryMovementFilters,
} from "@/lib/inventory-types";
import type { InventoryStockItem } from "@/lib/inventory-stock";

async function fetchMovementById(
  supabase: NonNullable<Awaited<ReturnType<typeof createScopedSupabase>>>,
  movementId: string,
) {
  const { data, error } = await supabase
    .from("inventory_movements")
    .select(MOVEMENT_SELECT)
    .eq("id", movementId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return movementsFromDb([data as DbMovementRow])[0];
}

async function fetchAssignmentById(
  supabase: NonNullable<Awaited<ReturnType<typeof createScopedSupabase>>>,
  assignmentId: string,
) {
  const { data, error } = await supabase
    .from("inventory_assignments")
    .select(ASSIGNMENT_SELECT)
    .eq("id", assignmentId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return assignmentsFromDb([data as DbAssignmentRow])[0];
}

export async function listInventoryMovementsAction(
  filters: InventoryMovementFilters,
): Promise<ActionResult<InventoryMovement[]>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "inventory.view")) {
      throw new Error("FORBIDDEN");
    }

    if (!canAccessWarehouse(session, filters.warehouseId)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    let query = supabase
      .from("inventory_movements")
      .select(MOVEMENT_SELECT)
      .eq("warehouse_id", filters.warehouseId)
      .eq("organization_id", session.organizationId)
      .order("created_at", { ascending: false });

    if (filters.itemId) {
      query = query.eq("item_id", filters.itemId);
    }

    if (filters.assigneeId) {
      query = query.eq("assignee_id", filters.assigneeId);
    }

    if (filters.type) {
      query = query.eq("type", filters.type);
    }

    if (filters.createdBy) {
      query = query.eq("created_by", filters.createdBy);
    }

    if (filters.dateFrom) {
      query = query.gte("created_at", filters.dateFrom);
    }

    if (filters.dateTo) {
      query = query.lte("created_at", filters.dateTo);
    }

    const limit = filters.limit ?? 100;
    const offset = filters.offset ?? 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      return fail(error.message);
    }

    return ok(movementsFromDb((data || []) as DbMovementRow[]));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function listInventoryAssignmentsAction(
  filters: InventoryAssignmentFilters,
): Promise<ActionResult<InventoryAssignment[]>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "inventory.view")) {
      throw new Error("FORBIDDEN");
    }

    if (!canAccessWarehouse(session, filters.warehouseId)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    let query = supabase
      .from("inventory_assignments")
      .select(ASSIGNMENT_SELECT)
      .eq("warehouse_id", filters.warehouseId)
      .eq("organization_id", session.organizationId)
      .order("assigned_at", { ascending: false });

    if (filters.status) {
      query = query.eq("status", filters.status);
    } else {
      query = query.eq("status", "open");
    }

    if (filters.itemId) {
      query = query.eq("item_id", filters.itemId);
    }

    if (filters.assigneeId) {
      query = query.eq("assignee_id", filters.assigneeId);
    }

    const { data, error } = await query;

    if (error) {
      return fail(error.message);
    }

    let rows = assignmentsFromDb((data || []) as DbAssignmentRow[]);
    const cleanQuery = filters.query?.trim().toLowerCase();

    if (cleanQuery) {
      rows = rows.filter((row) => {
        const haystack = [row.itemName, row.assigneeName, row.note]
          .join(" ")
          .toLowerCase();
        return haystack.includes(cleanQuery);
      });
    }

    return ok(rows);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function assignInventoryItemAction(input: {
  warehouseId: string;
  itemId: string;
  assigneeId: string;
  qty: number;
  note?: string;
}): Promise<
  ActionResult<{ assignment: InventoryAssignment; movement: InventoryMovement; item: InventoryStockItem }>
> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "inventory.assign")) {
      throw new Error("FORBIDDEN");
    }

    if (!canAccessWarehouse(session, input.warehouseId)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data, error } = await supabase.rpc("assign_inventory_item", {
      p_warehouse_id: input.warehouseId,
      p_item_id: input.itemId,
      p_assignee_id: input.assigneeId,
      p_qty: input.qty,
      p_note: input.note || "",
    });

    if (error) {
      return fail(error.message);
    }

    const payload = data as { assignment_id: string; movement_id: string };
    const [assignment, movement, stockResult] = await Promise.all([
      fetchAssignmentById(supabase, payload.assignment_id),
      fetchMovementById(supabase, payload.movement_id),
      supabase
        .from("inventory_stock")
        .select(
          "stock, reserved, assigned, unavailable, min_stock, inventory_items(id, name, kind, subcategory, size, location, unit, inventory_categories(name))",
        )
        .eq("warehouse_id", input.warehouseId)
        .eq("item_id", input.itemId)
        .maybeSingle(),
    ]);

    if (!assignment || !movement || !stockResult.data) {
      return fail("No se pudo cargar la asignacion");
    }

    const item = inventoryStockJoinToItem(
      input.itemId,
      stockResult.data as DbStockJoinRow,
    );

    if (!item) {
      return fail("No se pudo cargar el item");
    }

    return ok({
      assignment,
      movement,
      item,
    });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function closeInventoryAssignmentAction(input: {
  assignmentId: string;
  outcome: InventoryAssignmentOutcome;
  qtyReturned?: number;
  qtyConsumed?: number;
  qtyDamaged?: number;
  qtyLost?: number;
  note?: string;
}): Promise<
  ActionResult<{
    assignment: InventoryAssignment;
    movements: InventoryMovement[];
    item: InventoryStockItem | null;
  }>
> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "inventory.return")) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data: beforeAssignment } = await supabase
      .from("inventory_assignments")
      .select("warehouse_id, item_id, assigned_at")
      .eq("id", input.assignmentId)
      .maybeSingle();

    const { data, error } = await supabase.rpc("close_inventory_assignment", {
      p_assignment_id: input.assignmentId,
      p_outcome: input.outcome,
      p_qty_returned: input.qtyReturned ?? 0,
      p_qty_consumed: input.qtyConsumed ?? 0,
      p_qty_damaged: input.qtyDamaged ?? 0,
      p_qty_lost: input.qtyLost ?? 0,
      p_note: input.note || "",
    });

    if (error) {
      return fail(error.message);
    }

    const assignment = await fetchAssignmentById(supabase, input.assignmentId);

    if (!assignment) {
      return fail("No se pudo cargar la asignacion");
    }

    let movementsQuery = supabase
      .from("inventory_movements")
      .select(MOVEMENT_SELECT)
      .eq("assignment_id", input.assignmentId)
      .order("created_at", { ascending: false });

    if (beforeAssignment?.assigned_at) {
      movementsQuery = movementsQuery.gte("created_at", beforeAssignment.assigned_at);
    }

    const { data: movementRows } = await movementsQuery;

    let item: InventoryStockItem | null = null;

    if (beforeAssignment?.warehouse_id && beforeAssignment?.item_id) {
      const { data: stockResult } = await supabase
        .from("inventory_stock")
        .select(
          "stock, reserved, assigned, unavailable, min_stock, inventory_items(id, name, kind, subcategory, size, location, unit, inventory_categories(name))",
        )
        .eq("warehouse_id", beforeAssignment.warehouse_id)
        .eq("item_id", beforeAssignment.item_id)
        .maybeSingle();

      if (stockResult) {
        item = inventoryStockJoinToItem(
          beforeAssignment.item_id,
          stockResult as DbStockJoinRow,
        );
      }
    }

    return ok({
      assignment,
      movements: movementsFromDb((movementRows || []) as DbMovementRow[]),
      item,
    });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function ensureInventoryItemForLeafAction(input: {
  warehouseId: string;
  category: string;
  kind: string;
  subcategory?: string;
  itemName: string;
  minStock?: number;
}): Promise<ActionResult<{ itemId: string; item: InventoryStockItem }>> {
  const result = await ensureInventoryLeafItemAction(input);

  if (!result.ok) {
    return fail(result.error);
  }

  return ok({
    itemId: result.data.id,
    item: result.data,
  });
}
