import type { AppSession, PermissionKey } from "@/lib/auth/types";

// Conductores use a personal field workflow. This is identity-based by design;
// all other navigation is capability-based below.
const DRIVER_ROUTE_ACCESS = {
  conductor: ["/", "/conductor"],
} as const;

const PATH_PERMISSIONS: Record<string, PermissionKey[]> = {
  "/configuracion": [
    "settings.manage",
    "users.manage",
    "warehouses.manage",
    "permissions.manage",
    "time_clock.view",
    "time_clock.manage",
  ],
  "/inventario": ["inventory.view"],
  "/venta": ["sales.manage"],
  "/seguimiento": ["routes.view", "sales.manage", "audit.immutable.view"],
  "/logistica": ["routes.view", "routes.update_status"],
  "/ingreso-bodega": ["warehouses.manage", "sales.manage"],
  "/bodega": ["warehouses.manage", "sales.manage"],
  "/paletas": ["warehouses.manage", "sales.manage"],
  "/conductor": ["routes.view"],
  "/time-clock": ["time_clock.view", "time_clock.manage"],
  "/agencias": [
    "agency.view",
    "agency.create",
    "agency.edit",
    "agency.status.transition",
    "agency.captor.assign",
    "agency.supervisor.assign",
    "agency.support",
    "distribution.manage",
    "distribution.acquire",
    "commercial.settings.view",
    "commercial.settings.manage",
  ],
  "/agencia": [
    "agency.sales.view",
    "agency.sales.create",
    "agency.customers.manage",
    "agency.pricing.manage",
    "distribution.sell",
    "agency.daily_close.view",
    "agency.daily_close.prepare",
    "agency.daily_close.finalize",
  ],
  "/captacion": [
    "agency.view",
    "agency.captor.assign",
    "agency.support",
    "distribution.acquire",
  ],
  "/solicitudes": [
    "agency.requests.view",
    "agency.requests.create",
    "agency.requests.assign",
    "agency.visits.confirm",
  ],
  "/contabilidad": [
    "agency.account.view",
    "agency.account.charge",
    "agency.account.payment",
    "agency.account.apply",
    "accounting.view",
    "accounting.post",
    "accounting.reconcile",
    "accounting.reverse",
    "financial_hold.view",
    "financial_hold.release",
  ],
  "/auditoria": ["audit.immutable.view", "settings.manage"],
  "/estadisticas": ["audit.immutable.view"],
  "/vendedores": ["commercial.settings.view", "commercial.settings.manage"],
  "/distribuidores": ["distribution.manage"],
  "/distribuidor": ["distribution.sell"],
  "/mis-distribuidores": ["distribution.acquire"],
};

/** A platform account can administer organizations, never client operations. */
export function isPlatformOnlySession(session: AppSession | null): boolean {
  return Boolean(session?.isPlatformAdmin);
}

export function sessionHasPermission(
  session: AppSession | null,
  permission: PermissionKey,
) {
  if (!session) {
    return false;
  }

  if (permission.startsWith("agency.") && !session.agencyModuleEnabled) {
    return false;
  }

  if (session.permissions.includes("all")) {
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

  if (isPlatformOnlySession(session)) {
    if (pathname === "/perfil" || pathname.startsWith("/perfil/")) {
      return true;
    }
    return false;
  }

  if (pathname === "/perfil" || pathname.startsWith("/perfil/")) {
    return true;
  }

  if (
    !session.agencyModuleEnabled &&
    ["/agencia", "/agencias", "/captacion", "/solicitudes"].some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return false;
  }

  const base = "/" + (pathname.split("/").filter(Boolean)[0] || "");
  if (pathname === "/agencia/equipo" && !sessionHasPermission(session, "agency.users.manage")) {
    return false;
  }

  if (pathname === "/seguimiento/excepciones" || pathname.startsWith("/seguimiento/excepciones/")) {
    return [
      "package.custody.view",
      "package.custody.transfer",
      "package.custody.receive",
      "exceptions.report",
      "exceptions.resolve",
      "exceptions.approve",
    ].some((permission) => sessionHasPermission(session, permission as PermissionKey));
  }

  if (pathname === "/agencia/cierre" && ![
    "agency.daily_close.view",
    "agency.daily_close.prepare",
    "agency.daily_close.finalize",
  ].some((permission) => sessionHasPermission(session, permission as PermissionKey))) {
    return false;
  }

  if (
    session.roleSlug === "conductor" &&
    !DRIVER_ROUTE_ACCESS.conductor.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return false;
  }

  if (
    base === "/conductor" &&
    session.roleSlug !== "conductor" &&
    !sessionHasPermission(session, "all")
  ) {
    return false;
  }

  const required = PATH_PERMISSIONS[base];
  if (!required?.length) {
    return true;
  }

  return required.some((permission) =>
    sessionHasPermission(session, permission),
  );
}

export function canAccessWarehouse(
  session: AppSession | null,
  warehouseId: string,
) {
  if (!session) {
    return false;
  }

  return (
    sessionHasPermission(session, "all") ||
    session.warehouseIds.includes(warehouseId)
  );
}
