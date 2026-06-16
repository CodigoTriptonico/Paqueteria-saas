import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { ACT_AS_ORG_COOKIE } from "@/lib/auth/act-as";
import { APP_SESSION_COOKIE, readAppSessionCookieValue } from "@/lib/auth/app-session-cookie";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isClientOrganization } from "@/lib/organizations/kind";
import { readMaxWarehouses, type OrganizationSettings } from "@/lib/organizations/settings";
import type { AppSession, PermissionKey, RoleSlug } from "@/lib/auth/types";

const PLATFORM_VIEW_PERMISSIONS: PermissionKey[] = [
  "all",
  "users.manage",
  "permissions.manage",
  "warehouses.manage",
  "settings.manage",
  "sales.manage",
  "customers.manage",
  "inventory.view",
  "inventory.reserve",
  "inventory.adjust",
  "routes.view",
  "routes.update_status",
];

async function loadIsPlatformAdmin(userId: string, reader?: SupabaseClient | null) {
  const db = reader ?? createSupabaseAdminClient();
  if (!db) {
    return false;
  }

  const { data } = await db
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  return Boolean(data?.user_id);
}

async function loadActingOrganization(organizationId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return null;
  }

  const { data } = await admin
    .from("organizations")
    .select("id, name, settings, kind, is_active")
    .eq("id", organizationId)
    .maybeSingle();

  if (!data || !isClientOrganization(data.kind) || !data.is_active) {
    return null;
  }

  return data;
}

async function loadDevelopmentPlatformOwnerId() {
  if (process.env.VERCEL_ENV === "production") {
    return null;
  }

  const ownerEmail = process.env.PLATFORM_OWNER_EMAIL;
  const admin = createSupabaseAdminClient();
  if (!ownerEmail || !admin) {
    return null;
  }

  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("email", ownerEmail)
    .maybeSingle();

  if (error || !data?.id) {
    return null;
  }

  return data.id;
}

async function getDevelopmentPlatformOwnerSession(): Promise<AppSession | null> {
  const userId = await loadDevelopmentPlatformOwnerId();
  const admin = createSupabaseAdminClient();
  if (!userId || !admin) {
    return null;
  }

  const { data: profile, error } = await admin
    .from("profiles")
    .select(
      "id, email, full_name, organization_id, role_id, is_active, default_warehouse_id, roles(slug, name), organizations(name, settings, kind)",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile || profile.is_active === false) {
    return null;
  }

  const roleRow = profile.roles as { slug: RoleSlug; name: string } | { slug: RoleSlug; name: string }[] | null;
  const role = Array.isArray(roleRow) ? roleRow[0] : roleRow;
  const orgRow = profile.organizations as
    | { name: string; settings: OrganizationSettings; kind: string }
    | { name: string; settings: OrganizationSettings; kind: string }[]
    | null;
  const homeOrg = Array.isArray(orgRow) ? orgRow[0] : orgRow;
  const isPlatformAdmin = await loadIsPlatformAdmin(userId);

  return {
    userId,
    email: profile.email,
    fullName: profile.full_name,
    organizationId: profile.organization_id,
    organizationName: homeOrg?.name || "Empresa",
    homeOrganizationId: profile.organization_id,
    homeOrganizationName: homeOrg?.name || "Empresa",
    actingOrganizationId: null,
    actingOrganizationName: null,
    isActingAsClient: false,
    multiWarehouseEnabled: Boolean(homeOrg?.settings?.multi_warehouse_enabled),
    maxWarehouses: readMaxWarehouses(homeOrg?.settings),
    roleSlug: role?.slug || "administrador",
    roleName: role?.name || "Administrador",
    permissions: PLATFORM_VIEW_PERMISSIONS,
    warehouseIds: [],
    preferredWarehouseId: (profile.default_warehouse_id as string | null) || null,
    isPlatformAdmin,
  };
}

export async function getAppSession(): Promise<AppSession | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  const cookieStore = await cookies();
  const fallbackUserId = readAppSessionCookieValue(cookieStore.get(APP_SESSION_COOKIE)?.value);
  const userId = user?.id || fallbackUserId;
  const db = user ? supabase : createSupabaseAdminClient();

  if (!userId || !db) {
    return null;
  }

  const { data: profile, error } = await db
    .from("profiles")
    .select(
      "id, email, full_name, organization_id, role_id, is_active, default_warehouse_id, roles(slug, name), organizations(name, settings, kind)",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile || profile.is_active === false) {
    return null;
  }

  const roleRow = profile.roles as { slug: RoleSlug; name: string } | { slug: RoleSlug; name: string }[] | null;
  const role = Array.isArray(roleRow) ? roleRow[0] : roleRow;
  const orgRow = profile.organizations as
    | { name: string; settings: OrganizationSettings; kind: string }
    | { name: string; settings: OrganizationSettings; kind: string }[]
    | null;
  const homeOrg = Array.isArray(orgRow) ? orgRow[0] : orgRow;

  const homeOrganizationId = profile.organization_id;
  const homeOrganizationName = homeOrg?.name || "Empresa";

  const [{ data: grantedPerms }, { data: warehouseLinks }, isPlatformAdmin] = await Promise.all([
    db
      .from("role_permissions")
      .select("permissions(key)")
      .eq("role_id", profile.role_id)
      .eq("granted", true),
    db.from("profile_warehouses").select("warehouse_id").eq("profile_id", userId),
    loadIsPlatformAdmin(userId, db),
  ]);

  const basePermissions = (grantedPerms || [])
    .map((row) => {
      const perm = row.permissions as { key: PermissionKey } | { key: PermissionKey }[] | null;
      return Array.isArray(perm) ? perm[0]?.key : perm?.key;
    })
    .filter(Boolean) as PermissionKey[];

  let actingOrganizationId: string | null = null;
  let actingOrganizationName: string | null = null;
  let isActingAsClient = false;
  let organizationId = homeOrganizationId;
  let organizationName = homeOrganizationName;
  let multiWarehouseEnabled = Boolean(homeOrg?.settings?.multi_warehouse_enabled);
  let maxWarehouses = readMaxWarehouses(homeOrg?.settings);
  let roleSlug: RoleSlug = role?.slug || "vendedor";
  let roleName = role?.name || "Vendedor";
  let permissions = basePermissions;
  let warehouseIds = (warehouseLinks || []).map((row) => row.warehouse_id);
  let preferredWarehouseId = (profile.default_warehouse_id as string | null) || null;

  if (isPlatformAdmin) {
    const pathname = (await headers()).get("x-boxario-pathname") ?? "";
    const onPlatformRoute = pathname.startsWith("/platform");

    if (!onPlatformRoute) {
      const cookieStore = await cookies();
      const actAsId = cookieStore.get(ACT_AS_ORG_COOKIE)?.value?.trim();

      if (actAsId) {
        const actingOrg = await loadActingOrganization(actAsId);
        if (actingOrg) {
          actingOrganizationId = actingOrg.id;
          actingOrganizationName = actingOrg.name;
          isActingAsClient = true;
          organizationId = actingOrg.id;
          organizationName = actingOrg.name;
          multiWarehouseEnabled = Boolean(
            (actingOrg.settings as OrganizationSettings | null)?.multi_warehouse_enabled,
          );
          maxWarehouses = readMaxWarehouses(
            actingOrg.settings as OrganizationSettings | null,
          );
          roleSlug = "administrador";
          roleName = "Vista plataforma";
          permissions = PLATFORM_VIEW_PERMISSIONS;
          warehouseIds = [];
          preferredWarehouseId = null;
        }
      }
    }
  }

  return {
    userId,
    email: profile.email,
    fullName: profile.full_name,
    organizationId,
    organizationName,
    homeOrganizationId,
    homeOrganizationName,
    actingOrganizationId,
    actingOrganizationName,
    isActingAsClient,
    multiWarehouseEnabled,
    maxWarehouses,
    roleSlug,
    roleName,
    permissions,
    warehouseIds,
    preferredWarehouseId,
    isPlatformAdmin,
  };
}

export async function requireAppSession() {
  const session = (await getAppSession()) || (await getDevelopmentPlatformOwnerSession());

  if (!session) {
    throw new Error("UNAUTHORIZED");
  }

  return session;
}
