import { parseVehicleCargoCapacity, routeStopsWithinVehicleCapacity } from "@/lib/logistics-route-capacity";

export type LogisticsTaskType = "deliver_empty_box" | "pickup_full_box";

export type LogisticsRouteStatus =
  | "draft"
  | "planned"
  | "in_progress"
  | "cancelled"
  | "completed";

type LogisticsRouteStopOutcome = "completed" | "failed" | "cancelled";

export type LogisticsRouteStopAddress = {
  source: "customer" | "recipient_snapshot" | "unknown";
  name: string;
  phone: string;
  street: string;
  houseNumber: string;
  addressReference: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  formattedAddress: string;
  placeId: string;
  lat: number | null;
  lng: number | null;
};

export type LogisticsRouteTaskInput = {
  taskId: string;
  shipmentId: string;
  shipmentCode: string;
  customerName: string;
  taskType: LogisticsTaskType;
  scheduledAt: string | null;
  scheduleKind?: "exact" | "range" | "from" | null;
  windowStartAt?: string | null;
  windowEndAt?: string | null;
  warehouseId: string | null;
  assignedTo: string | null;
  address: LogisticsRouteStopAddress;
};

export type LogisticsRouteStopRow = {
  id: string;
  routeId: string;
  taskId: string;
  order: number;
  address: LogisticsRouteStopAddress;
  lat: number | null;
  lng: number | null;
  postalCode: string;
  city: string;
  outcome?: LogisticsRouteStopOutcome | null;
  outcomeAt?: string | null;
  releasedAt?: string | null;
  releaseReason?: string;
  createdAt: string;
};

export type LogisticsRouteRow = {
  id: string;
  routeDate: string;
  name: string;
  status: LogisticsRouteStatus;
  assignedTo: string | null;
  vehicleId: string | null;
  warehouseId: string | null;
  zoneKey: string;
  notes: string;
  routeTemplateId?: string | null;
  publishedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  stops: LogisticsRouteStopRow[];
};

type LogisticsRouteSuggestion = {
  id: string;
  routeDate: string;
  name: string;
  zoneKey: string;
  zoneLabel: string;
  warehouseId: string | null;
  taskIds: string[];
  stopCount: number;
  stops: LogisticsRouteTaskInput[];
};

export type SuggestLogisticsRoutesOptions = {
  fallbackDate: string;
  minimumStops?: number;
  vehicleCargoCapacity?: string | null;
  startPoint?: { lat: number; lng: number } | null;
};

const MISSING_GEO_ZONE = "falta-geo";
const NO_CITY_ZONE = "sin-ciudad";
const NO_POSTAL_ZONE = "sin-cp";

function normalizeZonePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function zipPrefix(value: string, length = 3) {
  const clean = value.replace(/\D/g, "");
  return clean ? clean.slice(0, length) : "";
}

function logisticsCityLabel(address: Pick<LogisticsRouteStopAddress, "city">) {
  return address.city.trim() || "Sin ciudad";
}

function scheduledDate(value: string | null, fallbackDate: string) {
  if (!value) {
    return fallbackDate;
  }

  return value.slice(0, 10) || fallbackDate;
}

export function hasRouteGeo(address: Pick<LogisticsRouteStopAddress, "lat" | "lng">) {
  return Number.isFinite(address.lat) && Number.isFinite(address.lng);
}

export function logisticsZoneKey(address: LogisticsRouteStopAddress) {
  if (!hasRouteGeo(address)) {
    return MISSING_GEO_ZONE;
  }

  const city = normalizeZonePart(address.city) || NO_CITY_ZONE;
  const postal = zipPrefix(address.postalCode) || NO_POSTAL_ZONE;

  return `${city}-${postal}`;
}

export function logisticsZoneLabel(address: LogisticsRouteStopAddress) {
  if (!hasRouteGeo(address)) {
    return "Falta geo";
  }

  return logisticsCityLabel(address);
}

export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const earthKm = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const haversine =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return earthKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function pointForTask(task: LogisticsRouteTaskInput) {
  if (!hasRouteGeo(task.address)) {
    return null;
  }

  return {
    lat: task.address.lat as number,
    lng: task.address.lng as number,
  };
}

function routeStartPoint(tasks: LogisticsRouteTaskInput[]) {
  const points = tasks.map(pointForTask).filter((point): point is { lat: number; lng: number } =>
    Boolean(point),
  );

  return {
    lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
    lng: points.reduce((sum, point) => sum + point.lng, 0) / points.length,
  };
}

function stableTaskCompare(a: LogisticsRouteTaskInput, b: LogisticsRouteTaskInput) {
  return (
    (a.windowStartAt || a.scheduledAt || "9999").localeCompare(
      b.windowStartAt || b.scheduledAt || "9999",
    ) ||
    a.address.postalCode.localeCompare(b.address.postalCode) ||
    a.address.city.localeCompare(b.address.city) ||
    a.shipmentCode.localeCompare(b.shipmentCode) ||
    a.taskId.localeCompare(b.taskId)
  );
}

export function orderStopsByProximity(
  tasks: LogisticsRouteTaskInput[],
  options?: { startPoint?: { lat: number; lng: number } | null },
) {
  // Nearest-neighbor heuristic. For production-grade optimization use Directions API or VRP solver.
  const remaining = tasks.filter((task) => hasRouteGeo(task.address)).sort(stableTaskCompare);
  if (!remaining.length) {
    return [];
  }

  const ordered: LogisticsRouteTaskInput[] = [];
  let current = options?.startPoint || routeStartPoint(remaining);

  while (remaining.length) {
    let nextIndex = 0;
    let nextDistance = Number.POSITIVE_INFINITY;
    const earliestWindow = Date.parse(
      remaining[0]?.windowStartAt || remaining[0]?.scheduledAt || "",
    );

    for (let index = 0; index < remaining.length; index += 1) {
      const point = pointForTask(remaining[index]);
      if (!point) {
        continue;
      }

      const candidateWindow = Date.parse(
        remaining[index].windowStartAt || remaining[index].scheduledAt || "",
      );
      const outsideEarliestWindow =
        Number.isFinite(earliestWindow) &&
        Number.isFinite(candidateWindow) &&
        candidateWindow - earliestWindow > 30 * 60 * 1000;
      if (outsideEarliestWindow) {
        continue;
      }

      const distance = distanceKm(current, point);
      if (distance < nextDistance) {
        nextDistance = distance;
        nextIndex = index;
      }
    }

    const [next] = remaining.splice(nextIndex, 1);
    ordered.push(next);
    current = pointForTask(next) || current;
  }

  return ordered;
}

export function suggestLogisticsRoutes(
  tasks: LogisticsRouteTaskInput[],
  options: SuggestLogisticsRoutesOptions,
) {
  const minimumStops = Math.max(options.minimumStops || 1, 1);
  const capacity = parseVehicleCargoCapacity(options.vehicleCargoCapacity);
  const groups = new Map<string, LogisticsRouteTaskInput[]>();

  for (const task of tasks) {
    if (!hasRouteGeo(task.address)) {
      continue;
    }

    const routeDate = scheduledDate(task.scheduledAt, options.fallbackDate);
    const zoneKey = logisticsZoneKey(task.address);
    const groupKey = [
      routeDate,
      task.warehouseId || "default",
      zoneKey,
    ].join("|");

    groups.set(groupKey, [...(groups.get(groupKey) || []), task]);
  }

  return Array.from(groups.entries())
    .map(([groupKey, groupTasks]) => {
      const [routeDate, warehouseKey] = groupKey.split("|");
      const stops = orderStopsByProximity(groupTasks, {
        startPoint: options.startPoint,
      });
      const first = stops[0];
      const zoneKey = first ? logisticsZoneKey(first.address) : NO_CITY_ZONE;
      const zoneLabel = first ? logisticsZoneLabel(first.address) : "Sin zona";
      const name = `${zoneLabel} · ${stops.length} paradas`;

      return {
        id: groupKey,
        routeDate,
        name,
        zoneKey,
        zoneLabel,
        warehouseId: warehouseKey === "default" ? null : warehouseKey,
        taskIds: stops.map((task) => task.taskId),
        stopCount: stops.length,
        stops,
      } satisfies LogisticsRouteSuggestion;
    })
    .filter((suggestion) => suggestion.stopCount >= minimumStops)
    .flatMap((suggestion) => {
      if (!capacity || routeStopsWithinVehicleCapacity(suggestion.stopCount, options.vehicleCargoCapacity)) {
        return [suggestion];
      }

      return Array.from(
        { length: Math.ceil(suggestion.stopCount / capacity) },
        (_, index) => {
          const stops = suggestion.stops.slice(index * capacity, (index + 1) * capacity);
          return {
            ...suggestion,
            id: `${suggestion.id}|${index + 1}`,
            name: `${suggestion.zoneLabel} ${index + 1} · ${stops.length} paradas`,
            taskIds: stops.map((task) => task.taskId),
            stopCount: stops.length,
            stops,
          } satisfies LogisticsRouteSuggestion;
        },
      );
    })
    .sort(
      (a, b) =>
        a.routeDate.localeCompare(b.routeDate) ||
        a.zoneLabel.localeCompare(b.zoneLabel) ||
        a.id.localeCompare(b.id),
    );
}

export function statusAfterRouteUnassign(
  currentStatus: string,
  scheduledAt: string | null,
) {
  if (currentStatus !== "assigned") {
    return currentStatus;
  }

  return scheduledAt ? "scheduled" : "pending";
}
