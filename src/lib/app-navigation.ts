import { conductorTasksNavLabel } from "@/lib/conductor-tareas-view";

export function resolveAppNavActiveLabel(pathname: string, roleSlug = "administrador") {
  if (pathname.startsWith("/venta")) return "Nueva venta";
  if (pathname.startsWith("/captacion")) return "Agencias a mi cargo";
  if (pathname.startsWith("/agencias")) return "Vendedores y agencias";
  if (pathname.startsWith("/agencia")) return "Mi agencia";
  if (pathname.startsWith("/solicitudes")) return "Solicitudes";
  if (pathname.startsWith("/contabilidad")) return "Contabilidad";
  if (pathname.startsWith("/mis-distribuidores")) return "Mis distribuidores";
  if (pathname.startsWith("/distribuidor")) {
    return pathname.startsWith("/distribuidores") ? "Distribuidores" : "Mi distribuidora";
  }
  if (pathname.startsWith("/inventario")) return "Inventario";
  if (pathname.startsWith("/ingreso-bodega")) return "Ingreso a bodega";
  if (pathname.startsWith("/bodega")) return "Bodega";
  if (pathname.startsWith("/paletas")) return "Paletas";
  if (pathname.startsWith("/seguimiento") || pathname.startsWith("/envios")) return "Seguimiento y envíos";
  if (pathname.startsWith("/conductor/inventario-camion")) return "Inventario camion";
  if (pathname.startsWith("/conductor")) return conductorTasksNavLabel(roleSlug);
  if (pathname.startsWith("/logistica")) return "Logistica";
  if (pathname.startsWith("/estadisticas") || pathname.startsWith("/vendedores")) return "Estadisticas";
  if (pathname.startsWith("/configuracion")) return "Configuracion";
  if (pathname.startsWith("/perfil")) return "Mi perfil";
  if (pathname.startsWith("/platform")) return "Plataforma";

  return "Inicio";
}
