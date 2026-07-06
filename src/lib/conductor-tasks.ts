import type { LogisticsTaskAddressRow } from "@/app/actions/logistics-routes";
import type {
  LogisticsTaskStatus,
  LogisticsTaskType,
  ShipmentRow,
} from "@/app/actions/shipments";
import {
  balanceDueFromShipment,
  depositFromShipment,
  quoteFromShipment,
} from "@/lib/shipment-display";
import {
  readConductorTruckBoxLinesFromPlan,
  type ConductorTruckBoxLine,
} from "@/lib/conductor-truck-inventory";
import { isClosedLogisticsStatus } from "@/lib/logistics-view";
import type { LogisticsRouteRow, LogisticsRouteStopRow } from "@/lib/logistics-routing";

export type ConductorDriverTask = {
  id: string;
  shipmentId: string;
  taskType: LogisticsTaskType;
  status: LogisticsTaskStatus;
  scheduledAt: string | null;
  warehouseId: string | null;
  shipmentCode: string;
  customerName: string;
  customerPhone: string | null;
  country: string;
  routeId: string | null;
  routeName: string | null;
  routeDate: string | null;
  stopOrder: number | null;
  addressLine: string | null;
  zoneLabel: string | null;
  boxLines: ConductorTruckBoxLine[];
  boxSummary: string;
  paid: number;
  depositDue: number;
  balanceDue: number;
  sortAt: string;
};

export const conductorTaskTypeLabel: Record<LogisticsTaskType, string> = {
  deliver_empty_box: "Dejar caja vacia",
  pickup_full_box: "Recoger caja llena",
};

export function buildRouteByTaskId(routes: ReadonlyArray<LogisticsRouteRow>) {
  const map = new Map<string, { route: LogisticsRouteRow; stop: LogisticsRouteStopRow }>();

  for (const route of routes) {
    if (route.status === "cancelled") {
      continue;
    }

    for (const stop of route.stops) {
      map.set(stop.taskId, { route, stop });
    }
  }

  return map;
}

export function isTaskAssignedToDriver(
  task: { assignedTo: string | null; status: string },
  routeInfo: { route: { assignedTo: string | null } } | undefined,
  driverId: string,
) {
  if (isClosedLogisticsStatus(task.status)) {
    return false;
  }

  if (task.assignedTo === driverId) {
    return true;
  }

  return routeInfo?.route.assignedTo === driverId;
}

export function buildConductorDriverTasks(input: {
  shipments: ReadonlyArray<ShipmentRow>;
  routes: ReadonlyArray<LogisticsRouteRow>;
  taskAddresses: ReadonlyArray<LogisticsTaskAddressRow>;
  driverId: string | null;
}): ConductorDriverTask[] {
  if (!input.driverId) {
    return [];
  }

  const routeByTaskId = buildRouteByTaskId(input.routes);
  const addressByTaskId = new Map(input.taskAddresses.map((row) => [row.taskId, row]));
  const tasks: ConductorDriverTask[] = [];

  for (const shipment of input.shipments) {
    for (const task of shipment.logisticsTasks) {
      const routeInfo = routeByTaskId.get(task.id);

      if (!isTaskAssignedToDriver(task, routeInfo, input.driverId)) {
        continue;
      }

      const address = addressByTaskId.get(task.id);
      const quote = quoteFromShipment(shipment);
      const boxLines = readConductorTruckBoxLinesFromPlan(shipment.logistics_plan);

      tasks.push({
        id: task.id,
        shipmentId: shipment.id,
        taskType: task.taskType,
        status: task.status,
        scheduledAt: task.scheduledAt,
        warehouseId: task.warehouseId,
        shipmentCode: shipment.code,
        customerName: shipment.customer_name,
        customerPhone: shipment.customerPhone || null,
        country: shipment.country,
        routeId: routeInfo?.route.id ?? null,
        routeName: routeInfo?.route.name ?? null,
        routeDate: routeInfo?.route.routeDate ?? null,
        stopOrder: routeInfo?.stop.order ?? null,
        addressLine: address?.address.formattedAddress || null,
        zoneLabel: address?.zoneLabel || null,
        boxLines,
        boxSummary: quote?.label || boxLines.map((line) => `(${line.quantity}) ${line.label}`).join(" + "),
        paid: shipment.paid,
        depositDue: Math.max(depositFromShipment(shipment) - shipment.paid, 0),
        balanceDue: balanceDueFromShipment(shipment, quote),
        sortAt: task.scheduledAt || task.createdAt,
      });
    }
  }

  return tasks.sort(
    (left, right) =>
      (left.routeDate || "").localeCompare(right.routeDate || "") ||
      (left.stopOrder ?? 9999) - (right.stopOrder ?? 9999) ||
      new Date(left.sortAt).getTime() - new Date(right.sortAt).getTime(),
  );
}

export function conductorTaskStatusClass(status: LogisticsTaskStatus) {
  if (status === "completed") {
    return "border-emerald-600 bg-emerald-400 text-slate-950";
  }

  if (status === "cancelled") {
    return "border-rose-700 bg-rose-500 text-slate-950";
  }

  if (status === "loaded_to_truck") {
    return "border-sky-700 bg-sky-400 text-slate-950";
  }

  if (status === "scheduled") {
    return "border-amber-700 bg-amber-400 text-slate-950";
  }

  if (status === "assigned") {
    return "border-emerald-700 bg-emerald-900 text-emerald-200";
  }

  return "border-black bg-surface-inset text-slate-300";
}
