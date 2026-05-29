import type { AppSession, PermissionKey, RoleSlug } from "@/lib/auth/types";

const ROLE_ROUTE_ACCESS: Record<RoleSlug, string[]> = {
  administrador: ["/", "/venta", "/inventario", "/envios", "/configuracion"],
  vendedor: ["/", "/venta", "/inventario"],
  conductor: ["/", "/envios"],
};

const PATH_PERMISSIONS: Record<string, PermissionKey[]> = {
  "/configuracion": ["settings.manage", "users.manage", "warehouses.manage", "permissions.manage"],
  "/inventario": ["inventory.view"],
  "/venta": ["sales.manage"],
  "/envios": ["routes.view"],
};

export function sessionHasPermission(
  session: AppSession | null,
  permission: PermissionKey,
) {
  if (!session) {
    return false;
  }

  if (session.roleSlug === "administrador" || session.permissions.includes("all")) {
    return true;
  }

  return session.permissions.includes(permission);
}

export function canAccessPath(session: AppSession | null, pathname: string) {
  if (!session) {
    return pathname === "/login";
  }

  if (pathname === "/platform" || pathname.startsWith("/platform/")) {
    return session.isPlatformAdmin;
  }

  const base = "/" + (pathname.split("/").filter(Boolean)[0] || "");
  const allowedPrefixes = ROLE_ROUTE_ACCESS[session.roleSlug] || [];

  if (!allowedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return false;
  }

  const required = PATH_PERMISSIONS[base];

  if (!required?.length) {
    return true;
  }

  return required.some((permission) => sessionHasPermission(session, permission));
}

export function canAccessWarehouse(session: AppSession | null, warehouseId: string) {
  if (!session) {
    return false;
  }

  if (session.roleSlug === "administrador" || session.warehouseIds.length === 0) {
    return true;
  }

  return session.warehouseIds.includes(warehouseId);
}
