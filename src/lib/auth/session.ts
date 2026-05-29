import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { AppSession, PermissionKey, RoleSlug } from "@/lib/auth/types";

async function loadIsPlatformAdmin(userId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return false;
  }

  const { data } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  return Boolean(data?.user_id);
}

export const getAppSession = cache(async (): Promise<AppSession | null> => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, organization_id, role_id, is_active, roles(slug, name), organizations(name, settings)",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile || profile.is_active === false) {
    return null;
  }

  const roleRow = profile.roles as { slug: RoleSlug; name: string } | { slug: RoleSlug; name: string }[] | null;
  const role = Array.isArray(roleRow) ? roleRow[0] : roleRow;
  const orgRow = profile.organizations as
    | { name: string; settings: { multi_warehouse_enabled?: boolean } }
    | { name: string; settings: { multi_warehouse_enabled?: boolean } }[]
    | null;
  const org = Array.isArray(orgRow) ? orgRow[0] : orgRow;

  const [{ data: grantedPerms }, { data: warehouseLinks }, isPlatformAdmin] = await Promise.all([
    supabase
      .from("role_permissions")
      .select("permissions(key)")
      .eq("role_id", profile.role_id)
      .eq("granted", true),
    supabase.from("profile_warehouses").select("warehouse_id").eq("profile_id", user.id),
    loadIsPlatformAdmin(user.id),
  ]);

  const permissions = (grantedPerms || [])
    .map((row) => {
      const perm = row.permissions as { key: PermissionKey } | { key: PermissionKey }[] | null;
      return Array.isArray(perm) ? perm[0]?.key : perm?.key;
    })
    .filter(Boolean) as PermissionKey[];

  return {
    userId: user.id,
    email: profile.email,
    fullName: profile.full_name,
    organizationId: profile.organization_id,
    organizationName: org?.name || "Empresa",
    multiWarehouseEnabled: Boolean(org?.settings?.multi_warehouse_enabled),
    roleSlug: role?.slug || "vendedor",
    roleName: role?.name || "Vendedor",
    permissions,
    warehouseIds: (warehouseLinks || []).map((row) => row.warehouse_id),
    isPlatformAdmin,
  };
});

export async function requireAppSession() {
  const session = await getAppSession();

  if (!session) {
    throw new Error("UNAUTHORIZED");
  }

  return session;
}
