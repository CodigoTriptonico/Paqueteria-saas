"use server";

import { requireAppSession } from "@/lib/auth/session";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";

export type DashboardSummary = {
  pendingShipments: number;
  salesToday: number;
  lowStockItems: number;
  activeCustomers: number;
};

export async function getDashboardSummaryAction(): Promise<ActionResult<DashboardSummary>> {
  try {
    const session = await requireAppSession();

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const orgId = session.organizationId;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [pendingResult, salesResult, stockResult, customersResult] = await Promise.all([
      sessionHasPermission(session, "routes.view")
        ? supabase
            .from("shipments")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", orgId)
            .in("status", ["Pendiente", "En oficina", "Pickup"])
        : Promise.resolve({ count: 0, error: null }),
      sessionHasPermission(session, "sales.manage") || sessionHasPermission(session, "routes.view")
        ? supabase
            .from("shipments")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", orgId)
            .gte("created_at", startOfDay.toISOString())
        : Promise.resolve({ count: 0, error: null }),
      sessionHasPermission(session, "inventory.view")
        ? supabase
            .from("inventory_stock")
            .select("stock, min_stock")
            .eq("organization_id", orgId)
        : Promise.resolve({ data: [], error: null }),
      sessionHasPermission(session, "customers.manage") ||
        sessionHasPermission(session, "sales.manage")
        ? supabase
            .from("customers")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", orgId)
            .eq("is_active", true)
        : Promise.resolve({ count: 0, error: null }),
    ]);

    const pendingShipments =
      pendingResult && "count" in pendingResult ? pendingResult.count || 0 : 0;
    const salesToday = salesResult && "count" in salesResult ? salesResult.count || 0 : 0;

    let lowStockItems = 0;

    if (stockResult && "data" in stockResult && stockResult.data) {
      lowStockItems = stockResult.data.filter(
        (row) => Number(row.stock) <= Number(row.min_stock),
      ).length;
    }

    const activeCustomers =
      customersResult && "count" in customersResult ? customersResult.count || 0 : 0;

    return ok({
      pendingShipments,
      salesToday,
      lowStockItems,
      activeCustomers,
    });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
