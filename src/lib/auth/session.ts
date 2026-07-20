import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAuthUser } from "@/lib/auth/resolve-auth-user";
import {
  buildAppSessionFromProfile,
  extractPermissionKeys,
  type ProfileSessionInput,
} from "@/lib/auth/session-build";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isDevAuthBypassEnabled } from "@/lib/auth/dev-auth-bypass";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { OrganizationSettings } from "@/lib/organizations/settings";
import { readMaxWarehouses } from "@/lib/organizations/settings";
import type { AppSession, RoleSlug } from "@/lib/auth/types";
import { PROFILE_AVATAR_BUCKET } from "@/lib/account/profile-validation";
import { ORGANIZATION_LOGO_BUCKET } from "@/lib/organizations/branding";
import { createStorageSignedUrl } from "@/lib/supabase/storage-url";

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
      "id, email, full_name, avatar_path, organization_id, role_id, is_active, default_warehouse_id, roles(slug, name), organizations(name, settings, kind)",
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
  const avatarUrl = profile.avatar_path
    ? await createStorageSignedUrl(admin, PROFILE_AVATAR_BUCKET, profile.avatar_path)
    : null;
  const organizationLogoUrl = homeOrg?.settings?.company_logo_path
    ? await createStorageSignedUrl(admin, ORGANIZATION_LOGO_BUCKET, homeOrg.settings.company_logo_path)
    : null;

  return {
    userId,
    email: profile.email,
    fullName: profile.full_name,
    avatarUrl,
    organizationId: profile.organization_id,
    organizationName: homeOrg?.name || "Empresa",
    organizationShortName: homeOrg?.settings?.company_short_name?.trim() || null,
    organizationLogoUrl,
    multiWarehouseEnabled: Boolean(homeOrg?.settings?.multi_warehouse_enabled),
    maxWarehouses: readMaxWarehouses(homeOrg?.settings),
    roleSlug: role?.slug || "administrador",
    roleName: role?.name || "Administrador",
    permissions: ["all"],
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
      "id, email, full_name, avatar_path, organization_id, role_id, is_active, default_warehouse_id, roles(slug, name), organizations(name, settings, kind)",
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

  const [{ data: grantedPerms }, { data: warehouseLinks }, isPlatformAdmin, avatarUrl, organizationLogoUrl] =
    await Promise.all([
    supabase
      .from("role_permissions")
      .select("permissions(key)")
      .eq("role_id", profile.role_id)
      .eq("granted", true),
    supabase.from("profile_warehouses").select("warehouse_id").eq("profile_id", userId),
    loadIsPlatformAdmin(userId, supabase),
    profile.avatar_path
      ? createStorageSignedUrl(supabase, PROFILE_AVATAR_BUCKET, profile.avatar_path)
      : Promise.resolve(null),
    homeOrg?.settings?.company_logo_path
      ? createStorageSignedUrl(supabase, ORGANIZATION_LOGO_BUCKET, homeOrg.settings.company_logo_path)
      : Promise.resolve(null),
  ]);

  const homeInput: ProfileSessionInput = {
    userId,
    email: profile.email,
    fullName: profile.full_name,
    avatarUrl,
    organizationId: profile.organization_id,
    defaultWarehouseId: (profile.default_warehouse_id as string | null) || null,
    roleSlug: role?.slug || "vendedor",
    roleName: role?.name || "Vendedor",
    homeOrganizationName: homeOrg?.name || "Empresa",
    homeOrganizationSettings: homeOrg?.settings,
    homeOrganizationLogoUrl: organizationLogoUrl,
    permissions: extractPermissionKeys(grantedPerms),
    warehouseIds: (warehouseLinks || []).map((row) => row.warehouse_id),
    isPlatformAdmin,
  };

  return buildAppSessionFromProfile(homeInput);
}

export const getAppSession = cache(resolveAppSessionUncached);

export async function requireAppSession() {
  const session = (await getAppSession()) || (await getDevelopmentPlatformOwnerSession());

  if (!session) {
    throw new Error("UNAUTHORIZED");
  }

  return session;
}
