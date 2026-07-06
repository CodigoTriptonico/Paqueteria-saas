import type { AppSession } from "@/lib/auth/types";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { canManageAllShipments } from "@/lib/shipment-visibility";
import { createScopedSupabase } from "@/lib/supabase/scoped";

export type InventarioStatsSnapshot = {
  trackedItems: number;
  lowStockItems: number;
  emptyStockItems: number;
  movementsLast7Days: number;
  openAssignments: number;
};

export async function loadInventarioStatsForSession(
  session: AppSession,
): Promise<InventarioStatsSnapshot> {
  if (!canManageAllShipments(session) && !sessionHasPermission(session, "inventory.view")) {
    throw new Error("FORBIDDEN");
  }

  const supabase = await createScopedSupabase(session);
  if (!supabase) {
    throw new Error("Supabase no configurado");
  }

  const orgId = session.organizationId;
  const since = new Date();
  since.setDate(since.getDate() - 7);
  since.setHours(0, 0, 0, 0);

  const [stockResult, movementsResult, assignmentsResult] = await Promise.all([
    supabase
      .from("inventory_stock")
      .select("stock, min_stock")
      .eq("organization_id", orgId),
    supabase
      .from("inventory_movements")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .gte("created_at", since.toISOString()),
    supabase
      .from("inventory_assignments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "open"),
  ]);

  const rows = stockResult.data || [];
  let lowStockItems = 0;
  let emptyStockItems = 0;

  for (const row of rows) {
    const stock = Number(row.stock) || 0;
    const minStock = Number(row.min_stock) || 0;

    if (stock <= 0) {
      emptyStockItems += 1;
    } else if (stock <= minStock) {
      lowStockItems += 1;
    }
  }

  return {
    trackedItems: rows.length,
    lowStockItems,
    emptyStockItems,
    movementsLast7Days: movementsResult.count || 0,
    openAssignments: assignmentsResult.count || 0,
  };
}
