import { isDevAuthBypassEnabled } from "@/lib/auth/dev-auth-bypass";
import { requireAppSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AppSession } from "@/lib/auth/types";


export async function requirePlatformAdmin(): Promise<AppSession> {
  let session: AppSession;
  try {
    session = await requireAppSession();
  } catch (error) {
    if (isDevAuthBypassEnabled() && process.env.PLATFORM_OWNER_EMAIL) {
      const admin = createSupabaseAdminClient();
      const { data: profile } = admin
        ? await admin
            .from("profiles")
            .select("id, email, full_name, organization_id, default_warehouse_id, organizations(name)")
            .eq("email", process.env.PLATFORM_OWNER_EMAIL)
            .maybeSingle()
        : { data: null };

      return {
        userId: profile?.id || "local-platform-owner",
        email: profile?.email || process.env.PLATFORM_OWNER_EMAIL,
        fullName: profile?.full_name || "Platform owner",
        organizationId: profile?.organization_id || "local-platform",
        organizationName: (profile?.organizations as { name?: string } | null)?.name || "Boxario",
        homeOrganizationId: profile?.organization_id || "local-platform",
        homeOrganizationName: (profile?.organizations as { name?: string } | null)?.name || "Boxario",
        actingOrganizationId: null,
        actingOrganizationName: null,
        isActingAsClient: false,
        multiWarehouseEnabled: false,
        maxWarehouses: 0,
        roleSlug: "administrador",
        roleName: "Administrador",
        permissions: ["all"],
        warehouseIds: [],
        preferredWarehouseId: (profile?.default_warehouse_id as string | null) || null,
        isPlatformAdmin: true,
      };
    }
    throw error;
  }

  if (!session.isPlatformAdmin) {
    throw new Error("FORBIDDEN");
  }

  return session;
}
