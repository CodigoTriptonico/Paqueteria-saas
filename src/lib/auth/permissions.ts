import type { AppSession, PermissionKey, RoleSlug } from "@/lib/auth/types";

const ROLE_ROUTE_ACCESS: Partial<Record<RoleSlug, string[]>> = {
  administrador: ["/", "/venta", "/inventario", "/envios", "/logistica", "/configuracion"],
  vendedor: ["/", "/venta", "/inventario"],
  conductor: ["/", "/envios"],
};

const PATH_PERMISSIONS: Record<string, PermissionKey[]> = {
  "/configuracion": ["settings.manage", "users.manage", "warehouses.manage", "permissions.manage"],
  "/inventario": ["inventory.view"],
  "/venta": ["sales.manage"],
  "/envios": ["routes.view"],
  "/logistica": ["routes.view", "routes.update_status"],
};

function effectiveRoleSlug(session: AppSession): RoleSlug {
  if (session.isActingAsClient && session.isPlatformAdmin) {
    return "administrador";
  }
  return session.roleSlug;
}

/** Dueño de Boxario sin paquetería cliente seleccionada (vista operativa bloqueada). */
export function platformAdminNeedsClientContext(session: AppSession | null): boolean {
  return Boolean(session?.isPlatformAdmin && !session.isActingAsClient);
}

export function sessionHasPermission(
  session: AppSession | null,
  permission: PermissionKey,
) {
  if (!session) {
    return false;
  }

  if (
    session.isActingAsClient &&
    session.isPlatformAdmin &&
    session.permissions.includes("all")
  ) {
    return true;
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

  if (platformAdminNeedsClientContext(session)) {
    return false;
  }

  const base = "/" + (pathname.split("/").filter(Boolean)[0] || "");
  const allowedPrefixes = ROLE_ROUTE_ACCESS[effectiveRoleSlug(session)];

  if (base === "/logistica" && effectiveRoleSlug(session) !== "administrador") {
    return false;
  }

  if (allowedPrefixes && !allowedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
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

  if (session.isActingAsClient || effectiveRoleSlug(session) === "administrador") {
    return true;
  }

  return session.warehouseIds.includes(warehouseId);
}
