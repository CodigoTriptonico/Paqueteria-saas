import type { LogisticsTaskStatus } from "@/app/actions/shipments";
import type { LogisticsRouteRow } from "@/lib/logistics-routing";
import { isClosedLogisticsStatus } from "@/lib/logistics-view";

export type RouteCompletionTaskStatus = {
  taskId: string;
  status: LogisticsTaskStatus;
};

export function canAutoCompleteRoute(
  route: Pick<LogisticsRouteRow, "status" | "stops">,
  taskStatuses: ReadonlyArray<RouteCompletionTaskStatus>,
): boolean {
  if (route.status !== "planned" && route.status !== "in_progress") {
    return false;
  }

  if (!route.stops.length) {
    return false;
  }

  const statusByTaskId = new Map(taskStatuses.map((entry) => [entry.taskId, entry.status]));

  for (const stop of route.stops) {
    const status = statusByTaskId.get(stop.taskId);

    if (!status || !isClosedLogisticsStatus(status)) {
      return false;
    }
  }

  return true;
}

export function routeCompletionBlockedReason(
  route: Pick<LogisticsRouteRow, "status" | "stops">,
  taskStatuses: ReadonlyArray<RouteCompletionTaskStatus>,
): string | null {
  if (route.status === "completed") {
    return "Ruta ya completada";
  }

  if (route.status === "cancelled") {
    return "Ruta cancelada";
  }

  if (route.status !== "planned" && route.status !== "in_progress") {
    return "Solo rutas planeadas o en curso se pueden cerrar";
  }

  if (!route.stops.length) {
    return "La ruta no tiene paradas";
  }

  const statusByTaskId = new Map(taskStatuses.map((entry) => [entry.taskId, entry.status]));

  for (const stop of route.stops) {
    const status = statusByTaskId.get(stop.taskId);

    if (!status) {
      return "Falta estado de una parada";
    }

    if (!isClosedLogisticsStatus(status)) {
      return "Quedan paradas abiertas";
    }
  }

  return null;
}
