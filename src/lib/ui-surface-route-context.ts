import type { UiSurfaceContextId } from "@/lib/ui-surface-context";

/** Contexto de paleta asociado a la ruta actual (sin overrides de página). */
export function resolveSurfaceContextFromPathname(pathname: string): UiSurfaceContextId | null {
  if (pathname.startsWith("/inventario")) {
    return "inventory.items";
  }

  if (pathname.startsWith("/auditoria")) {
    return "audit.shipments";
  }

  if (pathname.startsWith("/ingreso-bodega")) {
    return "warehouse.intake";
  }

  if (pathname.startsWith("/bodega")) {
    return "warehouse.inventory";
  }

  if (pathname.startsWith("/paletas")) {
    return "warehouse.pallets";
  }

  if (pathname.startsWith("/logistica")) {
    return "logistics.tasks";
  }

  if (pathname.startsWith("/seguimiento") || pathname.startsWith("/envios")) {
    return "shipments.tracking";
  }

  if (pathname.startsWith("/conductor/tareas")) {
    return "conductor.tasks";
  }

  if (pathname.startsWith("/estadisticas") || pathname.startsWith("/vendedores")) {
    return "stats.sales";
  }

  if (pathname.startsWith("/time-clock")) {
    return "timeclock.admin";
  }

  if (pathname.startsWith("/venta")) {
    return "sale.senderCard";
  }

  return null;
}
