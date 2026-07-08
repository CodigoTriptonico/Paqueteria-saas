import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { ACT_AS_ORG_COOKIE } from "@/lib/auth/act-as";
import { resolveAuthUser } from "@/lib/auth/resolve-auth-user";
import {
  buildAppSessionFromProfile,
  extractPermissionKeys,
  PLATFORM_VIEW_PERMISSIONS,
  resolveActingContext,
  type ProfileSessionInput,
} from "@/lib/auth/session-build";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isDevAuthBypassEnabled } from "@/lib/auth/dev-auth-bypass";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isClientOrganization } from "@/lib/organizations/kind";
import type { OrganizationSettings } from "@/lib/organizations/settings";
import { readMaxWarehouses } from "@/lib/organizations/settings";
import type { AppSession, RoleSlug } from "@/lib/auth/types";

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
  if (!isDevAuthBypassEnabled()) {
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

async function resolveAppSessionUncached(): Promise<AppSession | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return null;
  }

  const auth = await resolveAuthUser(() => supabase.auth.getUser());
  if (auth.status !== "authenticated") {
    return null;
  }

  const userId = auth.user.id;

  const { data: profile, error } = await supabase
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

  const [{ data: grantedPerms }, { data: warehouseLinks }, isPlatformAdmin] = await Promise.all([
    supabase
      .from("role_permissions")
      .select("permissions(key)")
      .eq("role_id", profile.role_id)
      .eq("granted", true),
    supabase.from("profile_warehouses").select("warehouse_id").eq("profile_id", userId),
    loadIsPlatformAdmin(userId, supabase),
  ]);

  const homeInput: ProfileSessionInput = {
    userId,
    email: profile.email,
    fullName: profile.full_name,
    organizationId: profile.organization_id,
    defaultWarehouseId: (profile.default_warehouse_id as string | null) || null,
    roleSlug: role?.slug || "vendedor",
    roleName: role?.name || "Vendedor",
    homeOrganizationName: homeOrg?.name || "Empresa",
    homeOrganizationSettings: homeOrg?.settings,
    permissions: extractPermissionKeys(grantedPerms),
    warehouseIds: (warehouseLinks || []).map((row) => row.warehouse_id),
    isPlatformAdmin,
  };

  const pathname = (await headers()).get("x-boxario-pathname") ?? "";
  const onPlatformRoute = pathname.startsWith("/platform");
  const cookieStore = await cookies();
  const actAsId = cookieStore.get(ACT_AS_ORG_COOKIE)?.value?.trim() || null;
  const actingOrg = actAsId ? await loadActingOrganization(actAsId) : null;

  const acting = resolveActingContext({
    isPlatformAdmin,
    onPlatformRoute,
    actAsOrganizationId: actAsId,
    actingOrg: actingOrg
      ? {
          id: actingOrg.id,
          name: actingOrg.name,
          settings: actingOrg.settings as OrganizationSettings | null,
        }
      : null,
    home: homeInput,
  });

  return buildAppSessionFromProfile(homeInput, acting);
}

export const getAppSession = cache(resolveAppSessionUncached);

export async function requireAppSession() {
  const session = (await getAppSession()) || (await getDevelopmentPlatformOwnerSession());

  if (!session) {
    throw new Error("UNAUTHORIZED");
  }

  return session;
}
