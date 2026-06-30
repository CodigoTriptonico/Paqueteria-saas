"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Loader2,
  MapPin,
  PackageCheck,
  PackageOpen,
  PlusCircle,
  Route,
  Search,
  Trash2,
  Truck,
  Warehouse,
  Wand2,
  XCircle,
} from "lucide-react";
import {
  addLogisticsRouteStopAction,
  assignLogisticsRouteDriverAction,
  cancelLogisticsRouteAction,
  createLogisticsRouteFromSuggestionAction,
  listLogisticsRoutesAction,
  listLogisticsTaskAddressesAction,
  removeLogisticsRouteStopAction,
  reorderLogisticsRouteStopsAction,
  suggestLogisticsRoutesAction,
  type LogisticsTaskAddressRow,
} from "@/app/actions/logistics-routes";
import {
  listRouteMembersAction,
  listShipmentsAction,
  updateLogisticsTaskAction,
  type LogisticsTaskStatus,
  type LogisticsTaskType,
  type RouteMemberRow,
  type ShipmentLogisticsTaskRow,
  type ShipmentRow,
} from "@/app/actions/shipments";
import { listWarehousesAction } from "@/app/actions/warehouses";
import { CountryName } from "@/components/country-flag";
import { InlineSearchCombobox } from "@/components/inline-search-picker";
import { PageLoading } from "@/components/page-loading";
import { SupabaseRequiredBanner } from "@/components/supabase-required-banner";
import {
  cardClass,
  inputClass,
  Panel,
  primaryButtonClass,
  secondaryButtonClass,
  textMutedClass,
} from "@/components/ui-blocks";
import { useNotify } from "@/hooks/use-notify";
import { splitLogisticsTasksByOpenState } from "@/lib/logistics-view";
import { hasNativePicker, openNativePicker } from "@/lib/native-picker";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { WarehouseRow } from "@/lib/auth/types";
import type {
  LogisticsRouteRow,
  LogisticsRouteStatus,
  LogisticsRouteStopRow,
  LogisticsRouteSuggestion,
  LogisticsRouteTaskInput,
} from "@/lib/logistics-routing";

type ShipmentQuote = {
  label: string;
  paid: string;
  cost: string;
};

type LogisticsTaskItem = ShipmentLogisticsTaskRow & {
  shipment: ShipmentRow;
  quote: ShipmentQuote | null;
};

type TaskAddressMeta = LogisticsTaskAddressRow & {
  routeId?: string;
  routeName?: string;
};

type GoogleMarker = {
  setMap: (map: GoogleMap | null) => void;
};

type GoogleMap = {
  fitBounds: (bounds: GoogleLatLngBounds) => void;
  setCenter: (point: { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
};

type GoogleLatLngBounds = {
  extend: (point: { lat: number; lng: number }) => void;
};

type GoogleMapsLike = {
  maps: {
    Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMap;
    Marker: new (options: Record<string, unknown>) => GoogleMarker;
    LatLngBounds: new () => GoogleLatLngBounds;
  };
};

declare global {
  interface Window {
    google?: GoogleMapsLike;
    __boxarioGoogleMapsPromise?: Promise<void>;
  }
}

const taskStatusLabel: Record<LogisticsTaskStatus, string> = {
  pending: "Pendiente",
  scheduled: "Con fecha",
  assigned: "Asignada",
  loaded_to_truck: "En ruta",
  completed: "Completada",
  cancelled: "Cancelada",
};

const taskTypeLabel: Record<LogisticsTaskType, string> = {
  deliver_empty_box: "Entregar caja vacia",
  pickup_full_box: "Recoger caja llena",
};

const taskTypeShortLabel: Record<LogisticsTaskType, string> = {
  deliver_empty_box: "Entrega",
  pickup_full_box: "Recoleccion",
};

const routeStatusLabel: Record<LogisticsRouteStatus, string> = {
  draft: "Draft",
  planned: "Planeada",
  cancelled: "Cancelada",
  completed: "Completada",
};

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function quoteFromShipment(row: ShipmentRow): ShipmentQuote | null {
  const plan = row.logistics_plan || {};
  const boxLines = Array.isArray(plan.boxLines)
    ? (plan.boxLines as Record<string, unknown>[])
    : [];

  if (boxLines.length) {
    const labels = boxLines
      .map((line) => {
        const label = String(line.label || "").trim();
        const quantity = Math.max(Number(line.quantity) || 1, 1);
        return label ? `${label} x${quantity}` : "";
      })
      .filter(Boolean);

    return {
      label: labels.join(" + "),
      paid: String(boxLines[0]?.paid || "0"),
      cost: String(boxLines[0]?.cost || "0"),
    };
  }

  const box =
    plan.box && typeof plan.box === "object" && !Array.isArray(plan.box)
      ? (plan.box as Record<string, unknown>)
      : null;
  const label = String(box?.label || box?.name || "").trim();

  if (!label) {
    return null;
  }

  return {
    label,
    paid: String(box?.paid || "0"),
    cost: String(box?.cost || "0"),
  };
}

function toDatetimeInput(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fromDatetimeInput(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function formatSchedule(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Fecha invalida";
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function taskSortValue(task: LogisticsTaskItem) {
  const value = task.scheduledAt || task.createdAt;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function statusBadgeClass(status: LogisticsTaskStatus) {
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

function routeStatusClass(status: LogisticsRouteStatus) {
  if (status === "planned") {
    return "border-emerald-700 bg-emerald-900 text-emerald-200";
  }

  if (status === "cancelled") {
    return "border-rose-700 bg-rose-950/60 text-rose-200";
  }

  if (status === "completed") {
    return "border-sky-700 bg-sky-950/60 text-sky-200";
  }

  return "border-black bg-surface-inset text-slate-300";
}

function taskTypeIcon(taskType: LogisticsTaskType) {
  return taskType === "deliver_empty_box" ? (
    <PackageOpen className="h-4 w-4" />
  ) : (
    <PackageCheck className="h-4 w-4" />
  );
}

function routeStopPoint(stop: LogisticsRouteStopRow) {
  if (Number.isFinite(stop.lat) && Number.isFinite(stop.lng)) {
    return { lat: stop.lat as number, lng: stop.lng as number };
  }

  if (Number.isFinite(stop.address.lat) && Number.isFinite(stop.address.lng)) {
    return { lat: stop.address.lat as number, lng: stop.address.lng as number };
  }

  return null;
}

function loadGoogleMaps(apiKey: string) {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Browser requerido"));
  }

  if (window.google?.maps) {
    return Promise.resolve();
  }

  if (window.__boxarioGoogleMapsPromise) {
    return window.__boxarioGoogleMapsPromise;
  }

  window.__boxarioGoogleMapsPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar Google Maps"));
    document.head.appendChild(script);
  });

  return window.__boxarioGoogleMapsPromise;
}

function LogisticsMap({
  route,
  taskById,
}: {
  route: LogisticsRouteRow | null;
  taskById: Map<string, LogisticsTaskItem>;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<GoogleMap | null>(null);
  const markersRef = useRef<GoogleMarker[]>([]);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const [mapError, setMapError] = useState("");

  useEffect(() => {
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    if (!apiKey || !mapRef.current || !route?.stops.length) {
      return;
    }

    let cancelled = false;

    void loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !window.google?.maps || !mapRef.current || !route?.stops.length) {
          return;
        }

        const firstPoint = routeStopPoint(route.stops[0]);
        const center = firstPoint || { lat: 34.0522, lng: -118.2437 };

        if (!mapInstanceRef.current) {
          mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
            center,
            zoom: 10,
            disableDefaultUI: true,
            zoomControl: true,
            backgroundColor: "#17211d",
          });
        }

        const bounds = new window.google.maps.LatLngBounds();
        const nextMarkers: GoogleMarker[] = [];

        route.stops.forEach((stop, index) => {
          const point = routeStopPoint(stop);
          if (!point || !window.google?.maps || !mapInstanceRef.current) {
            return;
          }

          bounds.extend(point);
          const task = taskById.get(stop.taskId);
          nextMarkers.push(
            new window.google.maps.Marker({
              position: point,
              map: mapInstanceRef.current,
              label: {
                text: String(index + 1),
                color: "#0f172a",
                fontWeight: "900",
              },
              title: task ? `${task.shipment.code} · ${task.shipment.customer_name}` : stop.address.name,
            }),
          );
        });

        markersRef.current = nextMarkers;

        if (nextMarkers.length > 1) {
          mapInstanceRef.current.fitBounds(bounds);
        } else {
          mapInstanceRef.current.setCenter(center);
          mapInstanceRef.current.setZoom(12);
        }

        setMapError("");
      })
      .catch((error: Error) => setMapError(error.message));

    return () => {
      cancelled = true;
    };
  }, [apiKey, route, taskById]);

  if (!apiKey) {
    return (
      <div className="flex h-full min-h-72 items-center justify-center rounded-lg border border-black bg-surface-inset p-4 text-center">
        <div>
          <MapPin className="mx-auto h-8 w-8 text-slate-600" />
          <p className="mt-2 text-sm font-black text-slate-300">Mapa apagado</p>
          <p className="mt-1 text-xs font-bold text-slate-500">
            Falta NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-72 overflow-hidden rounded-lg border border-black bg-surface-inset">
      <div ref={mapRef} className="h-full min-h-72 w-full" />
      {mapError ? (
        <div className="absolute inset-x-3 bottom-3 rounded-md border border-amber-700 bg-amber-400 px-3 py-2 text-xs font-black text-slate-950">
          {mapError}
        </div>
      ) : null}
    </div>
  );
}

export function LogisticaClient({
  initialShipments,
  initialRouteMembers,
  initialWarehouses,
  initialRoutes,
  initialTaskAddresses,
}: {
  initialShipments?: ShipmentRow[];
  initialRouteMembers?: RouteMemberRow[];
  initialWarehouses?: WarehouseRow[];
  initialRoutes?: LogisticsRouteRow[];
  initialTaskAddresses?: LogisticsTaskAddressRow[];
}) {
  const notify = useNotify();
  const supabaseReady = isSupabaseConfigured();
  const [shipments, setShipments] = useState<ShipmentRow[]>(initialShipments || []);
  const [routeMembers, setRouteMembers] = useState<RouteMemberRow[]>(initialRouteMembers || []);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>(initialWarehouses || []);
  const [routes, setRoutes] = useState<LogisticsRouteRow[]>(initialRoutes || []);
  const [taskAddresses, setTaskAddresses] = useState<LogisticsTaskAddressRow[]>(
    initialTaskAddresses || [],
  );
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState(todayInput());
  const [typeFilter, setTypeFilter] = useState("");
  const [driverFilter, setDriverFilter] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [suggestions, setSuggestions] = useState<LogisticsRouteSuggestion[]>([]);
  const [loaded, setLoaded] = useState(
    !supabaseReady ||
      Boolean(
        initialShipments &&
          initialRouteMembers &&
          initialWarehouses &&
          initialRoutes &&
          initialTaskAddresses,
      ),
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  async function reloadShipments() {
    const result = await listShipmentsAction();
    if (result.ok) {
      setShipments(result.data);
    } else {
      notify.error(result.error);
    }
  }

  async function reloadRoutesAndAddresses() {
    const [routesResult, addressesResult] = await Promise.all([
      listLogisticsRoutesAction(),
      listLogisticsTaskAddressesAction(),
    ]);

    if (routesResult.ok) {
      setRoutes(routesResult.data);
    } else {
      notify.error(routesResult.error);
    }

    if (addressesResult.ok) {
      setTaskAddresses(addressesResult.data);
    } else {
      notify.error(addressesResult.error);
    }
  }

  async function reloadAll() {
    await Promise.all([reloadShipments(), reloadRoutesAndAddresses()]);
  }

  useEffect(() => {
    if (
      !supabaseReady ||
      (initialShipments &&
        initialRouteMembers &&
        initialWarehouses &&
        initialRoutes &&
        initialTaskAddresses)
    ) {
      return;
    }

    queueMicrotask(() => {
      void (async () => {
        const [
          shipmentsResult,
          membersResult,
          warehousesResult,
          routesResult,
          addressesResult,
        ] = await Promise.all([
          listShipmentsAction(),
          listRouteMembersAction(),
          listWarehousesAction(),
          listLogisticsRoutesAction(),
          listLogisticsTaskAddressesAction(),
        ]);

        if (shipmentsResult.ok) {
          setShipments(shipmentsResult.data);
        } else {
          notify.error(shipmentsResult.error);
        }

        if (membersResult.ok) {
          setRouteMembers(membersResult.data);
        }

        if (warehousesResult.ok) {
          setWarehouses(warehousesResult.data);
        }

        if (routesResult.ok) {
          setRoutes(routesResult.data);
        }

        if (addressesResult.ok) {
          setTaskAddresses(addressesResult.data);
        }

        setLoaded(true);
      })();
    });
  }, [
    initialRouteMembers,
    initialRoutes,
    initialShipments,
    initialTaskAddresses,
    initialWarehouses,
    notify,
    supabaseReady,
  ]);

  const memberById = useMemo(() => {
    return new Map(routeMembers.map((member) => [member.id, member.label]));
  }, [routeMembers]);

  const warehouseById = useMemo(() => {
    return new Map(warehouses.map((warehouse) => [warehouse.id, warehouse.name]));
  }, [warehouses]);

  const routeByTaskId = useMemo(() => {
    const map = new Map<string, { route: LogisticsRouteRow; stop: LogisticsRouteStopRow }>();

    routes.forEach((route) => {
      if (route.status === "cancelled") {
        return;
      }

      route.stops.forEach((stop) => {
        map.set(stop.taskId, { route, stop });
      });
    });

    return map;
  }, [routes]);

  const addressByTaskId = useMemo(() => {
    const map = new Map<string, TaskAddressMeta>();

    taskAddresses.forEach((address) => {
      const routeInfo = routeByTaskId.get(address.taskId);
      map.set(address.taskId, {
        ...address,
        routeId: routeInfo?.route.id,
        routeName: routeInfo?.route.name,
      });
    });

    return map;
  }, [routeByTaskId, taskAddresses]);

  const allTasks = useMemo<LogisticsTaskItem[]>(() => {
    return shipments
      .flatMap((shipment) => {
        const quote = quoteFromShipment(shipment);
        return shipment.logisticsTasks.map((task) => ({
          ...task,
          shipment,
          quote,
        }));
      })
      .sort((a, b) => taskSortValue(a) - taskSortValue(b));
  }, [shipments]);

  const taskById = useMemo(() => {
    return new Map(allTasks.map((task) => [task.id, task]));
  }, [allTasks]);

  const taskSearchOptions = useMemo(
    () =>
      allTasks.map((task) => ({
        value: task.id,
        label: `${task.shipment.code} - ${task.shipment.customer_name}`,
        searchText: [
          task.shipment.code,
          task.shipment.customer_name,
          task.shipment.country,
          task.shipment.carrier,
          taskTypeLabel[task.taskType],
          taskStatusLabel[task.status],
          task.quote?.label,
          task.notes,
          memberById.get(task.assignedTo || ""),
          addressByTaskId.get(task.id)?.zoneLabel,
        ]
          .filter(Boolean)
          .join(" "),
      })),
    [addressByTaskId, allTasks, memberById],
  );

  const zoneOptions = useMemo(() => {
    const zones = new Map<string, string>();
    taskAddresses.forEach((address) => zones.set(address.zoneKey, address.zoneLabel));
    return Array.from(zones.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [taskAddresses]);

  const filteredTasks = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    const cleanType = typeFilter.trim();
    const cleanDriver = driverFilter.trim();
    const cleanWarehouse = warehouseFilter.trim();
    const cleanZone = zoneFilter.trim();

    return allTasks.filter((task) => {
      const address = addressByTaskId.get(task.id);
      const routeInfo = routeByTaskId.get(task.id);
      const dateMatches =
        !dateFilter || !task.scheduledAt || task.scheduledAt.slice(0, 10) === dateFilter;
      const haystack = [
        task.shipment.code,
        task.shipment.customer_name,
        task.shipment.country,
        task.shipment.carrier,
        taskTypeLabel[task.taskType],
        taskStatusLabel[task.status],
        task.quote?.label,
        task.notes,
        memberById.get(task.assignedTo || ""),
        address?.zoneLabel,
        address?.address.formattedAddress,
        routeInfo?.route.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        dateMatches &&
        (!cleanQuery || haystack.includes(cleanQuery)) &&
        (!cleanType || task.taskType === cleanType) &&
        (!cleanDriver || task.assignedTo === cleanDriver || routeInfo?.route.assignedTo === cleanDriver) &&
        (!cleanWarehouse || task.warehouseId === cleanWarehouse || routeInfo?.route.warehouseId === cleanWarehouse) &&
        (!cleanZone || address?.zoneKey === cleanZone)
      );
    });
  }, [
    addressByTaskId,
    allTasks,
    dateFilter,
    driverFilter,
    memberById,
    query,
    routeByTaskId,
    typeFilter,
    warehouseFilter,
    zoneFilter,
  ]);

  const { open: openTasks } = useMemo(
    () => splitLogisticsTasksByOpenState(filteredTasks),
    [filteredTasks],
  );

  const unroutedTasks = useMemo(
    () => openTasks.filter((task) => !routeByTaskId.has(task.id)),
    [openTasks, routeByTaskId],
  );

  const filteredRoutes = useMemo(() => {
    return routes
      .filter((route) => route.status !== "cancelled")
      .filter((route) => !dateFilter || route.routeDate === dateFilter)
      .filter((route) => !driverFilter || route.assignedTo === driverFilter)
      .filter((route) => !warehouseFilter || route.warehouseId === warehouseFilter)
      .filter((route) => !zoneFilter || route.zoneKey === zoneFilter)
      .sort((a, b) => a.routeDate.localeCompare(b.routeDate) || a.name.localeCompare(b.name));
  }, [dateFilter, driverFilter, routes, warehouseFilter, zoneFilter]);

  const selectedRoute = useMemo(() => {
    return routes.find((route) => route.id === selectedRouteId) || filteredRoutes[0] || null;
  }, [filteredRoutes, routes, selectedRouteId]);

  const openCount = allTasks.filter(
    (task) => task.status !== "completed" && task.status !== "cancelled",
  ).length;
  const routedCount = openTasks.filter((task) => routeByTaskId.has(task.id)).length;
  const missingGeoCount = openTasks.filter((task) => !addressByTaskId.get(task.id)?.hasGeo).length;
  const hasFilters = Boolean(
    query.trim() || typeFilter || driverFilter || warehouseFilter || zoneFilter,
  );

  async function changeTask(
    task: LogisticsTaskItem,
    patch: Omit<Parameters<typeof updateLogisticsTaskAction>[0], "taskId">,
  ) {
    setBusyId(task.id);
    const result = await updateLogisticsTaskAction({
      taskId: task.id,
      ...patch,
    });

    if (!result.ok) {
      notify.error(result.error);
      setBusyId(null);
      return;
    }

    await reloadAll();
    setBusyId(null);
    notify.success("Tarea actualizada");
  }

  async function loadSuggestions() {
    setBusyId("suggestions");
    const result = await suggestLogisticsRoutesAction({ routeDate: dateFilter || todayInput() });
    setBusyId(null);

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    setSuggestions(result.data);
    notify.success(`${result.data.length} sugerencias listas`);
  }

  async function createRoute(suggestion: LogisticsRouteSuggestion) {
    setBusyId(`suggestion:${suggestion.id}`);
    const result = await createLogisticsRouteFromSuggestionAction({
      routeDate: suggestion.routeDate,
      name: suggestion.name,
      zoneKey: suggestion.zoneKey,
      warehouseId: suggestion.warehouseId,
      taskIds: suggestion.taskIds,
    });
    setBusyId(null);

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    setSelectedRouteId(result.data.id);
    setSuggestions((current) => current.filter((entry) => entry.id !== suggestion.id));
    await reloadAll();
    notify.success("Ruta creada");
  }

  async function addToRoute(task: LogisticsTaskItem) {
    if (!selectedRoute) {
      return;
    }

    setBusyId(`add:${task.id}`);
    const result = await addLogisticsRouteStopAction({
      routeId: selectedRoute.id,
      taskId: task.id,
    });
    setBusyId(null);

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    setSelectedRouteId(result.data.id);
    await reloadAll();
    notify.success("Parada agregada");
  }

  async function removeStop(stop: LogisticsRouteStopRow) {
    if (!selectedRoute) {
      return;
    }

    setBusyId(`remove:${stop.id}`);
    const result = await removeLogisticsRouteStopAction({
      routeId: selectedRoute.id,
      stopId: stop.id,
    });
    setBusyId(null);

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    await reloadAll();
    notify.success("Parada liberada");
  }

  async function moveStop(stop: LogisticsRouteStopRow, direction: -1 | 1) {
    if (!selectedRoute) {
      return;
    }

    const index = selectedRoute.stops.findIndex((entry) => entry.id === stop.id);
    const nextIndex = index + direction;

    if (index < 0 || nextIndex < 0 || nextIndex >= selectedRoute.stops.length) {
      return;
    }

    const stopIds = selectedRoute.stops.map((entry) => entry.id);
    [stopIds[index], stopIds[nextIndex]] = [stopIds[nextIndex], stopIds[index]];
    setBusyId(`reorder:${stop.id}`);
    const result = await reorderLogisticsRouteStopsAction({
      routeId: selectedRoute.id,
      stopIds,
    });
    setBusyId(null);

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    await reloadRoutesAndAddresses();
  }

  async function assignRoute(routeId: string, assignedTo: string | null) {
    setBusyId(`driver:${routeId}`);
    const result = await assignLogisticsRouteDriverAction({ routeId, assignedTo });
    setBusyId(null);

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    await reloadAll();
    notify.success("Ruta actualizada");
  }

  async function cancelRoute(route: LogisticsRouteRow) {
    setBusyId(`cancel:${route.id}`);
    const result = await cancelLogisticsRouteAction(route.id);
    setBusyId(null);

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    setSelectedRouteId("");
    await reloadAll();
    notify.success("Ruta cancelada");
  }

  function renderTaskCard(task: LogisticsTaskItem, mode: "unrouted" | "route" = "unrouted") {
    const address = addressByTaskId.get(task.id);
    const routeInfo = routeByTaskId.get(task.id);
    const driverLabel = task.assignedTo
      ? memberById.get(task.assignedTo) || task.assignedTo
      : "Sin asignar";
    const warehouseLabel = task.warehouseId
      ? warehouseById.get(task.warehouseId) || task.warehouseId
      : "Default";
    const canAdd =
      mode === "unrouted" &&
      selectedRoute &&
      selectedRoute.status !== "cancelled" &&
      selectedRoute.status !== "completed" &&
      address?.hasGeo;

    return (
      <article
        key={task.id}
        className="rounded-lg border border-black bg-surface-card shadow-[0_6px_18px_rgba(0,0,0,0.18)]"
      >
        <div className="border-b border-black bg-surface-card-header px-3 py-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-base font-black text-[#f8fafc]">{task.shipment.code}</p>
              <p className="truncate text-xs font-black text-slate-300">
                {task.shipment.customer_name}
              </p>
            </div>
            {busyId === task.id || busyId === `add:${task.id}` ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-300" />
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-black bg-surface-inset px-2 py-1 text-[11px] font-black text-slate-200">
              {taskTypeIcon(task.taskType)}
              {taskTypeShortLabel[task.taskType]}
            </span>
            <span
              className={`rounded-md border px-2 py-1 text-[11px] font-black ${statusBadgeClass(task.status)}`}
            >
              {taskStatusLabel[task.status]}
            </span>
            {!address?.hasGeo ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-700 bg-amber-400 px-2 py-1 text-[11px] font-black text-slate-950">
                <AlertTriangle className="h-3 w-3" />
                Falta geo
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-2 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <CountryName name={task.shipment.country} size="xs" labelClassName={textMutedClass} />
            <span className="rounded-md border border-black bg-surface-inset px-2 py-1 text-xs font-black text-slate-300">
              {address?.zoneLabel || "Sin zona"}
            </span>
          </div>

          <p className="line-clamp-2 rounded-md border border-black bg-surface-inset px-2 py-1 text-xs font-bold leading-snug text-slate-300">
            {address?.address.formattedAddress || task.notes || "Sin direccion para ruta"}
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="relative grid gap-1 rounded-md border border-black bg-[#26312c] px-2 py-2">
              <span className="pointer-events-none inline-flex items-center gap-1 text-[10px] font-black uppercase text-slate-500">
                <Truck className="h-3.5 w-3.5 text-emerald-300" />
                Chofer
              </span>
              <span className="pointer-events-none truncate text-sm font-black text-[#f8fafc]">
                {driverLabel}
              </span>
              <select
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                value={task.assignedTo || ""}
                disabled={Boolean(routeInfo) || busyId === task.id}
                aria-label="Chofer"
                onChange={(event) =>
                  void changeTask(task, {
                    assignedTo: event.target.value || null,
                  })
                }
              >
                <option value="">Sin asignar</option>
                {routeMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="relative grid gap-1 rounded-md border border-black bg-[#26312c] px-2 py-2">
              <span className="pointer-events-none inline-flex items-center gap-1 text-[10px] font-black uppercase text-slate-500">
                <CalendarClock className="h-3.5 w-3.5 text-amber-300" />
                Fecha
              </span>
              <span className="pointer-events-none truncate text-sm font-black text-[#f8fafc]">
                {formatSchedule(task.scheduledAt)}
              </span>
              <input
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                type="datetime-local"
                value={toDatetimeInput(task.scheduledAt)}
                disabled={Boolean(routeInfo) || busyId === task.id}
                aria-label="Fecha"
                onPointerDown={(event) => {
                  if (openNativePicker(event.currentTarget)) {
                    event.preventDefault();
                  }
                }}
                onClick={(event) => {
                  if (hasNativePicker(event.currentTarget)) {
                    event.preventDefault();
                  }
                }}
                onChange={(event) =>
                  void changeTask(task, {
                    scheduledAt: fromDatetimeInput(event.target.value),
                  })
                }
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-black text-slate-500">
              <Warehouse className="h-3.5 w-3.5" />
              {warehouseLabel}
            </span>
            {routeInfo ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-black bg-surface-inset px-2 py-1 text-[11px] font-black text-emerald-300">
                <Route className="h-3.5 w-3.5" />
                {routeInfo.route.name}
              </span>
            ) : (
              <button
                type="button"
                className={`${secondaryButtonClass} h-9 px-3 text-xs disabled:opacity-45`}
                disabled={!canAdd || busyId === `add:${task.id}`}
                onClick={() => void addToRoute(task)}
              >
                <PlusCircle className="h-4 w-4" />
                Agregar
              </button>
            )}
          </div>
        </div>
      </article>
    );
  }

  if (!loaded) {
    return <PageLoading inline />;
  }

  return (
    <Panel title="Logistica" hideHeader clipContent={false}>
      {!supabaseReady ? (
        <SupabaseRequiredBanner detail="La logistica se lee desde shipments, shipment_logistics_tasks y logistics_routes en Supabase." />
      ) : null}

      {supabaseReady ? (
        <div className="grid gap-4">
          <div className={`${cardClass} overflow-visible`}>
            <div className="grid gap-2 p-3 2xl:grid-cols-[auto_minmax(18rem,1fr)_10rem_12rem_12rem_12rem_12rem_auto] 2xl:items-center">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h1 className="mr-1 truncate text-xl font-black text-[#f8fafc]">Logistica</h1>
                <span className="inline-flex h-11 items-center gap-2 rounded-md border border-black bg-surface-inset px-2">
                  <span className="text-[10px] font-black uppercase text-slate-500">Abiertas</span>
                  <span className="text-lg font-black text-[#f8fafc]">{openCount}</span>
                </span>
                <span className="inline-flex h-11 items-center gap-2 rounded-md border border-black bg-surface-inset px-2">
                  <span className="text-[10px] font-black uppercase text-slate-500">En ruta</span>
                  <span className="text-lg font-black text-emerald-300">{routedCount}</span>
                </span>
                <span className="inline-flex h-11 items-center gap-2 rounded-md border border-black bg-surface-inset px-2">
                  <span className="text-[10px] font-black uppercase text-slate-500">Sin geo</span>
                  <span className="text-lg font-black text-amber-300">{missingGeoCount}</span>
                </span>
              </div>

              <InlineSearchCombobox
                value={query}
                onChange={setQuery}
                options={taskSearchOptions}
                placeholder="Buscar invoice, cliente, ruta"
                emptyLabel="Sin tareas"
                ariaLabel="Buscar tareas de logistica"
                leadingIcon={<Search className="h-4 w-4" aria-hidden />}
                className="w-full"
                minWidthClass="w-full min-w-0"
                onSelectOption={(option) => {
                  const task = allTasks.find((entry) => entry.id === option.value);
                  if (task) {
                    setQuery(task.shipment.code);
                  }
                }}
              />

              <input
                className={inputClass}
                type="date"
                value={dateFilter}
                aria-label="Fecha de ruta"
                onChange={(event) => setDateFilter(event.target.value)}
              />

              <select
                className={inputClass}
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                aria-label="Filtrar por tipo de tarea"
              >
                <option value="">Todo tipo</option>
                <option value="deliver_empty_box">Entregas</option>
                <option value="pickup_full_box">Recolecciones</option>
              </select>

              <select
                className={inputClass}
                value={driverFilter}
                onChange={(event) => setDriverFilter(event.target.value)}
                aria-label="Filtrar por chofer"
              >
                <option value="">Todo chofer</option>
                {routeMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.label}
                  </option>
                ))}
              </select>

              <select
                className={inputClass}
                value={warehouseFilter}
                onChange={(event) => setWarehouseFilter(event.target.value)}
                aria-label="Filtrar por bodega"
              >
                <option value="">Toda bodega</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>

              <select
                className={inputClass}
                value={zoneFilter}
                onChange={(event) => setZoneFilter(event.target.value)}
                aria-label="Filtrar por zona"
              >
                <option value="">Toda zona</option>
                {zoneOptions.map(([zoneKey, label]) => (
                  <option key={zoneKey} value={zoneKey}>
                    {label}
                  </option>
                ))}
              </select>

              <div className="flex gap-2">
                <button
                  type="button"
                  className={`${secondaryButtonClass} h-11 justify-center disabled:opacity-50`}
                  disabled={!hasFilters}
                  onClick={() => {
                    setQuery("");
                    setTypeFilter("");
                    setDriverFilter("");
                    setWarehouseFilter("");
                    setZoneFilter("");
                  }}
                >
                  <XCircle className="h-4 w-4" />
                  Limpiar
                </button>
                <button
                  type="button"
                  className={`${primaryButtonClass} h-11 justify-center disabled:opacity-50`}
                  disabled={busyId === "suggestions"}
                  onClick={() => void loadSuggestions()}
                >
                  {busyId === "suggestions" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}
                  Sugerir
                </button>
              </div>
            </div>
          </div>

          {suggestions.length ? (
            <section className="overflow-hidden rounded-xl border border-black bg-surface-panel">
              <div className="border-b border-black bg-surface-card-header px-3 py-3">
                <p className="text-base font-black text-[#f8fafc]">Sugerencias</p>
                <p className="mt-0.5 text-xs font-bold text-slate-500">
                  Grupos por fecha, bodega, ciudad y CP. Tu decides crear.
                </p>
              </div>
              <div className="grid gap-2 p-3 md:grid-cols-2 2xl:grid-cols-3">
                {suggestions.map((suggestion) => (
                  <article
                    key={suggestion.id}
                    className="rounded-lg border border-black bg-surface-card p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-[#f8fafc]">
                          {suggestion.name}
                        </p>
                        <p className="mt-1 text-xs font-bold text-slate-500">
                          {suggestion.routeDate} · {suggestion.zoneLabel}
                        </p>
                      </div>
                      <span className="rounded-md border border-black bg-surface-inset px-2 py-1 text-sm font-black text-emerald-300">
                        {suggestion.stopCount}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-bold text-slate-400">
                        {suggestion.stops
                          .slice(0, 3)
                          .map((stop: LogisticsRouteTaskInput) => stop.shipmentCode)
                          .join(", ")}
                      </p>
                      <button
                        type="button"
                        className={`${primaryButtonClass} h-9 px-3 text-xs disabled:opacity-50`}
                        disabled={busyId === `suggestion:${suggestion.id}`}
                        onClick={() => void createRoute(suggestion)}
                      >
                        {busyId === `suggestion:${suggestion.id}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <PlusCircle className="h-4 w-4" />
                        )}
                        Crear ruta
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <div className="grid gap-3 2xl:grid-cols-[minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1.05fr)_minmax(22rem,0.8fr)]">
            <section className="overflow-hidden rounded-xl border border-black bg-surface-panel">
              <div className="border-b border-black bg-surface-card-header px-3 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-base font-black text-[#f8fafc]">Sin ruta</p>
                    <p className="mt-0.5 truncate text-xs font-bold text-slate-500">
                      Tareas abiertas disponibles
                    </p>
                  </div>
                  <span className="rounded-md border border-black bg-surface-inset px-2 py-1 text-sm font-black text-slate-200">
                    {unroutedTasks.length}
                  </span>
                </div>
              </div>

              <div className="grid max-h-[70vh] gap-3 overflow-y-auto p-3">
                {unroutedTasks.length ? (
                  unroutedTasks.map((task) => renderTaskCard(task))
                ) : (
                  <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-black bg-surface-inset px-4 text-center">
                    <div>
                      <ClipboardList className="mx-auto h-7 w-7 text-slate-600" />
                      <p className="mt-2 text-sm font-black text-slate-300">Sin tareas sueltas</p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-black bg-surface-panel">
              <div className="border-b border-black bg-surface-card-header px-3 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-base font-black text-[#f8fafc]">Rutas</p>
                    <p className="mt-0.5 truncate text-xs font-bold text-slate-500">
                      Draft y planeadas
                    </p>
                  </div>
                  <span className="rounded-md border border-black bg-surface-inset px-2 py-1 text-sm font-black text-slate-200">
                    {filteredRoutes.length}
                  </span>
                </div>
              </div>

              <div className="grid max-h-[70vh] gap-2 overflow-y-auto p-3">
                {filteredRoutes.length ? (
                  filteredRoutes.map((route) => (
                    <button
                      key={route.id}
                      type="button"
                      className={`grid gap-2 rounded-lg border p-3 text-left transition ${
                        selectedRoute?.id === route.id
                          ? "border-emerald-600 bg-emerald-950/45"
                          : "border-black bg-surface-card hover:bg-surface-card-hover"
                      }`}
                      onClick={() => setSelectedRouteId(route.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-[#f8fafc]">{route.name}</p>
                          <p className="mt-0.5 text-xs font-bold text-slate-500">
                            {route.routeDate} · {memberById.get(route.assignedTo || "") || "Sin chofer"}
                          </p>
                        </div>
                        <span
                          className={`rounded-md border px-2 py-1 text-[11px] font-black ${routeStatusClass(route.status)}`}
                        >
                          {routeStatusLabel[route.status]}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-black text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {route.stops.length} paradas
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Warehouse className="h-3.5 w-3.5" />
                          {warehouseById.get(route.warehouseId || "") || "Default"}
                        </span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-black bg-surface-inset px-4 text-center">
                    <div>
                      <Route className="mx-auto h-7 w-7 text-slate-600" />
                      <p className="mt-2 text-sm font-black text-slate-300">Sin rutas</p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-black bg-surface-panel">
              <div className="border-b border-black bg-surface-card-header px-3 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-base font-black text-[#f8fafc]">
                      {selectedRoute?.name || "Detalle ruta"}
                    </p>
                    <p className="mt-0.5 truncate text-xs font-bold text-slate-500">
                      {selectedRoute
                        ? `${selectedRoute.routeDate} · ${selectedRoute.stops.length} paradas`
                        : "Selecciona una ruta"}
                    </p>
                  </div>
                  {selectedRoute ? (
                    <span
                      className={`rounded-md border px-2 py-1 text-[11px] font-black ${routeStatusClass(selectedRoute.status)}`}
                    >
                      {routeStatusLabel[selectedRoute.status]}
                    </span>
                  ) : null}
                </div>

                {selectedRoute ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <select
                      className={inputClass}
                      value={selectedRoute.assignedTo || ""}
                      disabled={busyId === `driver:${selectedRoute.id}`}
                      aria-label="Chofer de ruta"
                      onChange={(event) =>
                        void assignRoute(selectedRoute.id, event.target.value || null)
                      }
                    >
                      <option value="">Sin chofer</option>
                      {routeMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className={`${secondaryButtonClass} h-11 justify-center text-rose-200 disabled:opacity-50`}
                      disabled={
                        busyId === `cancel:${selectedRoute.id}` ||
                        (selectedRoute.status !== "draft" && selectedRoute.status !== "planned")
                      }
                      onClick={() => void cancelRoute(selectedRoute)}
                    >
                      {busyId === `cancel:${selectedRoute.id}` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Cancelar
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="grid max-h-[70vh] gap-3 overflow-y-auto p-3">
                {selectedRoute?.stops.length ? (
                  selectedRoute.stops.map((stop, index) => {
                    const task = taskById.get(stop.taskId);
                    return (
                      <article
                        key={stop.id}
                        className="rounded-lg border border-black bg-surface-card p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 gap-2">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-black bg-emerald-400 text-sm font-black text-slate-950">
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-[#f8fafc]">
                                {task?.shipment.code || stop.address.name || stop.taskId}
                              </p>
                              <p className="truncate text-xs font-bold text-slate-400">
                                {task?.shipment.customer_name || stop.address.name}
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-black bg-surface-inset text-slate-300 disabled:opacity-40"
                              disabled={index === 0 || busyId === `reorder:${stop.id}`}
                              onClick={() => void moveStop(stop, -1)}
                              aria-label="Subir parada"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-black bg-surface-inset text-slate-300 disabled:opacity-40"
                              disabled={
                                index === selectedRoute.stops.length - 1 ||
                                busyId === `reorder:${stop.id}`
                              }
                              onClick={() => void moveStop(stop, 1)}
                              aria-label="Bajar parada"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-black bg-surface-inset text-rose-200 disabled:opacity-40"
                              disabled={busyId === `remove:${stop.id}`}
                              onClick={() => void removeStop(stop)}
                              aria-label="Quitar parada"
                            >
                              {busyId === `remove:${stop.id}` ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                        <p className="mt-2 line-clamp-2 rounded-md border border-black bg-surface-inset px-2 py-1 text-xs font-bold leading-snug text-slate-300">
                          {stop.address.formattedAddress || "Sin direccion"}
                        </p>
                        {task ? (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-black pt-2">
                            <span className="inline-flex items-center gap-1.5 rounded-md border border-black bg-surface-inset px-2 py-1 text-[11px] font-black text-slate-200">
                              {taskTypeIcon(task.taskType)}
                              {taskTypeShortLabel[task.taskType]}
                            </span>
                            <span
                              className={`rounded-md border px-2 py-1 text-[11px] font-black ${statusBadgeClass(task.status)}`}
                            >
                              {taskStatusLabel[task.status]}
                            </span>
                            <span className="rounded-md border border-black bg-surface-inset px-2 py-1 text-[11px] font-black text-slate-400">
                              {formatSchedule(task.scheduledAt)}
                            </span>
                          </div>
                        ) : null}
                      </article>
                    );
                  })
                ) : (
                  <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-black bg-surface-inset px-4 text-center">
                    <div>
                      <CheckCircle2 className="mx-auto h-7 w-7 text-slate-600" />
                      <p className="mt-2 text-sm font-black text-slate-300">Sin paradas</p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-black bg-surface-panel">
              <div className="border-b border-black bg-surface-card-header px-3 py-3">
                <p className="text-base font-black text-[#f8fafc]">Mapa</p>
                <p className="mt-0.5 truncate text-xs font-bold text-slate-500">
                  Paradas numeradas de la ruta seleccionada
                </p>
              </div>
              <div className="p-3">
                <LogisticsMap route={selectedRoute} taskById={taskById} />
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
