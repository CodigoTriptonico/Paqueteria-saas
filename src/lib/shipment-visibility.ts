import { sessionHasPermission } from "@/lib/auth/permissions";
import type { AppSession } from "@/lib/auth/types";

export type ShipmentVisibilityScope = "all" | "sales_owner" | "driver" | "none";

export function canManageAllShipments(session: AppSession | null) {
  if (!session) {
    return false;
  }

  return session.roleSlug === "administrador" || session.permissions.includes("all");
}

export function canChangeShipmentSalesOwner(session: AppSession | null) {
  if (!session) {
    return false;
  }

  return session.roleSlug === "administrador";
}

export function shipmentVisibilityScope(session: AppSession | null): ShipmentVisibilityScope {
  if (!session) {
    return "none";
  }

  if (canManageAllShipments(session)) {
    return "all";
  }

  if (sessionHasPermission(session, "audit.immutable.view")) {
    return "all";
  }

  if (session.roleSlug === "conductor" && sessionHasPermission(session, "routes.view")) {
    return "driver";
  }

  if (sessionHasPermission(session, "sales.manage")) {
    return "sales_owner";
  }

  if (sessionHasPermission(session, "routes.view")) {
    return "driver";
  }

  return "none";
}
