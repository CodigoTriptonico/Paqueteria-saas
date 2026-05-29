import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { canAccessPath } from "@/lib/auth/permissions";
import type { AppSession, PermissionKey, RoleSlug } from "@/lib/auth/types";

const PUBLIC_PATHS = ["/login", "/api/validate-address"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp)$/)
  ) {
    return NextResponse.next();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!user || isPublic) {
    return response;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, organization_id, role_id, is_active, roles(slug, name), organizations(name, settings)")
    .eq("id", user.id)
    .single();

  if (!profile?.is_active) {
    return NextResponse.redirect(new URL("/login?error=inactive", request.url));
  }

  const roleRow = profile.roles as { slug: RoleSlug; name: string } | { slug: RoleSlug; name: string }[];
  const role = Array.isArray(roleRow) ? roleRow[0] : roleRow;
  const orgRow = profile.organizations as
    | { name: string; settings: { multi_warehouse_enabled?: boolean } }
    | { name: string; settings: { multi_warehouse_enabled?: boolean } }[];
  const org = Array.isArray(orgRow) ? orgRow[0] : orgRow;

  const { data: grantedPerms } = await supabase
    .from("role_permissions")
    .select("permissions(key)")
    .eq("role_id", profile.role_id)
    .eq("granted", true);

  const permissions = (grantedPerms || [])
    .map((row) => {
      const perm = row.permissions as { key: PermissionKey } | { key: PermissionKey }[] | null;
      return Array.isArray(perm) ? perm[0]?.key : perm?.key;
    })
    .filter(Boolean) as PermissionKey[];

  const { data: warehouseLinks } = await supabase
    .from("profile_warehouses")
    .select("warehouse_id")
    .eq("profile_id", user.id);

  const { data: platformAdminRow } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const session: AppSession = {
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
    isPlatformAdmin: Boolean(platformAdminRow?.user_id),
  };

  if (!canAccessPath(session, pathname)) {
    return NextResponse.redirect(new URL("/?error=forbidden", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
