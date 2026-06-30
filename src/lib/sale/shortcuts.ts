import type { AppSession } from "@/lib/auth/types";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { createScopedSupabase } from "@/lib/supabase/scoped";

export type SaleShortcuts = {
  recentCustomerIds: string[];
  lastRecipientByCustomerId: Record<string, string>;
};

type ShipmentShortcutRow = {
  customer_id: string | null;
  recipient_id: string | null;
  created_at: string;
};

const RECENT_CUSTOMER_LIMIT = 3;
const SHIPMENT_SCAN_LIMIT = 40;

export async function listSaleShortcutsForSession(session: AppSession): Promise<SaleShortcuts> {
  if (!sessionHasPermission(session, "sales.manage")) {
    throw new Error("FORBIDDEN");
  }

  const supabase = await createScopedSupabase(session);
  if (!supabase) {
    return { recentCustomerIds: [], lastRecipientByCustomerId: {} };
  }

  const { data, error } = await supabase
    .from("shipments")
    .select("customer_id, recipient_id, created_at")
    .eq("organization_id", session.organizationId)
    .not("customer_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(SHIPMENT_SCAN_LIMIT);

  if (error) {
    if (error.code === "42P01") {
      return { recentCustomerIds: [], lastRecipientByCustomerId: {} };
    }

    throw new Error(error.message);
  }

  const recentCustomerIds: string[] = [];
  const lastRecipientByCustomerId: Record<string, string> = {};
  const seenCustomers = new Set<string>();

  for (const row of (data || []) as ShipmentShortcutRow[]) {
    const customerId = row.customer_id;
    if (!customerId) {
      continue;
    }

    if (!seenCustomers.has(customerId)) {
      seenCustomers.add(customerId);
      if (recentCustomerIds.length < RECENT_CUSTOMER_LIMIT) {
        recentCustomerIds.push(customerId);
      }
    }

    if (row.recipient_id && !lastRecipientByCustomerId[customerId]) {
      lastRecipientByCustomerId[customerId] = row.recipient_id;
    }
  }

  return { recentCustomerIds, lastRecipientByCustomerId };
}
