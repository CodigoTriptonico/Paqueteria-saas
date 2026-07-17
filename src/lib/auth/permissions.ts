import type { AppSession, PermissionKey, RoleSlug } from "@/lib/auth/types";

const ROLE_ROUTE_ACCESS: Partial<Record<RoleSlug, string[]>> = {
  administrador: ["/", "/venta", "/inventario", "/seguimiento", "/ingreso-bodega", "/bodega", "/paletas", "/logistica", "/estadisticas", "/auditoria", "/vendedores", "/configuracion", "/time-clock", "/agencias", "/contabilidad", "/solicitudes", "/distribuidores", "/conductor"],
  vendedor: ["/", "/venta", "/inventario", "/seguimiento"],
  conductor: ["/", "/conductor"],
  distribuidor: ["/", "/agencia", "/solicitudes", "/distribuidor"],
  administrador_agencia: ["/", "/agencia", "/venta", "/solicitudes"],
  vendedor_agencia: ["/", "/agencia", "/venta"],
  caja_agencia: ["/", "/agencia"],
  operador_agencia: ["/", "/agencia", "/solicitudes"],
  captador_distribuidores: ["/", "/captacion", "/mis-distribuidores"],
  captador_agencias: ["/", "/captacion"],
  supervisor_agencias: ["/", "/captacion", "/agencias"],
  finanzas: ["/", "/contabilidad", "/agencias", "/seguimiento"],
  logistica: ["/", "/logistica", "/solicitudes", "/seguimiento"],
  bodega: ["/", "/inventario", "/ingreso-bodega", "/bodega", "/paletas"],
  auditor: ["/", "/auditoria", "/estadisticas", "/contabilidad"],
};

const PATH_PERMISSIONS: Record<string, PermissionKey[]> = {
  "/configuracion": ["settings.manage", "users.manage", "warehouses.manage", "permissions.manage", "time_clock.view", "time_clock.manage"],
  "/inventario": ["inventory.view"],
  "/venta": ["sales.manage"],
  "/seguimiento": ["routes.view", "sales.manage"],
  "/logistica": ["routes.view", "routes.update_status"],
  "/ingreso-bodega": ["warehouses.manage", "sales.manage"],
  "/bodega": ["warehouses.manage", "sales.manage"],
  "/paletas": ["warehouses.manage", "sales.manage"],
  "/conductor": ["routes.view"],
  "/time-clock": ["time_clock.view", "time_clock.manage"],
  "/agencias": ["agency.view", "agency.create", "agency.edit", "agency.status.transition", "agency.captor.assign", "agency.supervisor.assign", "agency.support", "distribution.manage", "distribution.acquire"],
  "/agencia": ["agency.sales.view", "agency.sales.create", "agency.customers.manage", "agency.pricing.manage", "distribution.sell"],
  "/captacion": ["agency.view", "agency.captor.assign", "agency.support", "distribution.acquire"],
  "/solicitudes": ["agency.requests.view", "agency.requests.create", "agency.requests.assign", "agency.visits.confirm"],
  "/contabilidad": ["agency.account.view", "agency.account.charge", "agency.account.payment", "agency.account.apply", "accounting.view", "accounting.post", "accounting.reconcile", "accounting.reverse", "financial_hold.view", "financial_hold.release"],
  "/auditoria": ["audit.immutable.view", "settings.manage"],
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

  if (base === "/logistica" && !["administrador", "logistica"].includes(effectiveRoleSlug(session))) {
    return false;
  }

  if (base === "/estadisticas" && !["administrador", "auditor"].includes(effectiveRoleSlug(session))) {
    return false;
  }

  if (base === "/vendedores" && effectiveRoleSlug(session) !== "administrador") {
    return false;
  }

  if (base === "/time-clock" && effectiveRoleSlug(session) !== "administrador") {
    return requiredTimeClockAccess(session);
  }

  if (
    base === "/conductor" &&
    effectiveRoleSlug(session) !== "conductor" &&
    effectiveRoleSlug(session) !== "administrador"
  ) {
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

function requiredTimeClockAccess(session: AppSession) {
  return (
    sessionHasPermission(session, "time_clock.view") ||
    sessionHasPermission(session, "time_clock.manage")
  );
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
