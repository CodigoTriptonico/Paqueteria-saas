import type { AppSession } from "@/lib/auth/types";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { createScopedSupabase } from "@/lib/supabase/scoped";

export type DashboardSummary = {
  pendingShipments: number;
  salesToday: number;
  lowStockItems: number;
  activeCustomers: number;
};

export async function loadDashboardSummaryForSession(
  session: AppSession,
): Promise<DashboardSummary> {
  const supabase = await createScopedSupabase(session);
  if (!supabase) {
    throw new Error("Supabase no configurado");
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
          .eq("invoice_status", "paid")
          .eq("accounting_status", "exportable")
          .gte("finalized_at", startOfDay.toISOString())
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

  return {
    pendingShipments,
    salesToday,
    lowStockItems,
    activeCustomers,
  };
}
