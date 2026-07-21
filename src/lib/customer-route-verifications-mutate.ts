import type { AppSession } from "@/lib/auth/types";
import { CUSTOMER_ROUTE_ZONE_CHANGE_REASON } from "@/lib/customer-route-verification";
import type { createScopedSupabase } from "@/lib/supabase/scoped";

type Supabase = NonNullable<Awaited<ReturnType<typeof createScopedSupabase>>>;

export async function revokeCustomerRouteVerificationsForZoneChange(input: {
  supabase: Supabase;
  session: AppSession;
  customerId: string;
  previousZoneKey: string;
  nextZoneKey: string;
}) {
  if (input.previousZoneKey === input.nextZoneKey) {
    return { revoked: 0 };
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await input.supabase
    .from("customer_route_verifications")
    .update({
      ended_at: nowIso,
      end_reason: CUSTOMER_ROUTE_ZONE_CHANGE_REASON,
    })
    .eq("organization_id", input.session.organizationId)
    .eq("customer_id", input.customerId)
    .is("ended_at", null)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  const { error: pendingError } = await input.supabase
    .from("customer_route_assignment_requests")
    .update({
      status: "rejected",
      reviewed_by: input.session.userId,
      reviewed_at: nowIso,
      review_note: CUSTOMER_ROUTE_ZONE_CHANGE_REASON,
      updated_at: nowIso,
    })
    .eq("organization_id", input.session.organizationId)
    .eq("customer_id", input.customerId)
    .eq("status", "pending");

  if (pendingError) {
    throw new Error(pendingError.message);
  }

  return { revoked: (data || []).length };
}
