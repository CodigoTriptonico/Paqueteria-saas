"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ClipboardList,
  Loader2,
  MapPin,
  PackageCheck,
  PackageOpen,
  Pencil,
  Phone,
  Boxes,
  PlusCircle,
  Route,
  Search,
  Trash2,
  Truck,
  Warehouse,
  Wand2,
  X,
  XCircle,
} from "lucide-react";
import {
  addLogisticsRouteStopAction,
  assignLogisticsRouteDriverAction,
  assignLogisticsRouteVehicleAction,
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
import { listLogisticsVehiclesAction } from "@/app/actions/logistics-fleet";
import { ActionConfirmDialog } from "@/components/action-confirm-dialog";
import { CountryName } from "@/components/country-flag";
import { DateInput } from "@/components/date-input";
import { InvoicePriorityBadge } from "@/components/invoice-priority-badge";
import { LogisticsAddressGeoEditor } from "@/components/logistica/logistics-address-geo-editor";
import { LogisticsEvidenceGallery } from "@/components/logistica/logistics-evidence-gallery";
import { LogisticsDriverChangeDialog } from "@/components/logistica/logistics-driver-change-dialog";
import { LogisticsKpisStrip } from "@/components/logistica/logistics-kpis-strip";
import { LogisticsTaskEditPanel } from "@/components/logistica/logistics-task-edit-panel";
import { LogisticsTaskReprogramPanel } from "@/components/logistica/logistics-task-reprogram-panel";
import { LogisticsSectionNav } from "@/components/logistica/logistics-section-nav";
import { LogisticsTaskStatusBadge } from "@/components/logistica/logistics-task-status-badge";
import { InlineSearchCombobox, InlineSearchPicker } from "@/components/inline-search-picker";
import { PageLoading } from "@/components/page-loading";
import { SupabaseRequiredBanner } from "@/components/supabase-required-banner";
import {
  cardClass,
  Panel,
  primaryButtonClass,
  secondaryButtonClass,
  textMutedClass,
} from "@/components/ui-blocks";
import { useNotify } from "@/hooks/use-notify";
import {
  buildDriverPickerOptions,
  driverLabel,
  formatLogisticsTaskStatusLabel,
  logisticsScheduleDisplayParts,
  logisticsActionIconWellClass,
  logisticsPriorityCardClass,
  logisticsPriorityHeaderClass,
  logisticsPriorityAwaitingDriver,
  logisticsTaskWaitingParts,
  logisticsUnroutedTaskCardClass,
  logisticsWaitingToneClass,
  prioritizeLogisticsTasks,
  resolveLogisticsInvoiceStep,
  sortLogisticsInvoiceItemsByPriority,
  resolveLogisticsShipmentDeepLink,
  resolveRouteConfirmCopy,
  shouldConfirmDriverChange,
  splitLogisticsTasksByOpenState,
  type LogisticsInvoiceStep,
} from "@/lib/logistics-view";
import { canEditLogisticsTaskFields } from "@/lib/logistics-task-edit";
import { estimateRouteStopEtaMinutes, formatEtaMinutes } from "@/lib/logistics-eta";
import { isLogisticsFailedTask } from "@/lib/logistics-reprogram";
import { LOGISTICS_LIVE_REFRESH_MS, shouldRunLogisticsLiveRefresh } from "@/lib/logistics-live-refresh";
import { quoteFromShipment, type ShipmentQuote } from "@/lib/shipment-display";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { WarehouseRow } from "@/lib/auth/types";
import type {
  LogisticsRouteRow,
  LogisticsRouteStatus,
  LogisticsRouteStopRow,
  LogisticsRouteSuggestion,
  LogisticsRouteTaskInput,
} from "@/lib/logistics-routing";
import type { LogisticsVehicleRow } from "@/lib/logistics-fleet";

type LogisticsTaskItem = ShipmentLogisticsTaskRow & {
  shipment: ShipmentRow;
  quote: ShipmentQuote | null;
};

type LogisticsInvoiceItem = {
  shipment: ShipmentRow;
  quote: ShipmentQuote | null;
  step: LogisticsInvoiceStep<LogisticsTaskItem>;
  currentTask: LogisticsTaskItem | null;
  nextTask: LogisticsTaskItem | null;
};

const LOGISTICS_CARD_PICKER_SHELL =
  "box-border inline-flex h-7 w-full min-w-0 items-center gap-1.5 rounded-md border-0 bg-transparent px-0";

type PendingDriverChange = {
  task: LogisticsTaskItem;
  nextAssignedTo: string | null;
};

type EditingTaskState = {
  task: LogisticsTaskItem;
};

type ReprogrammingTaskState = {
  task: LogisticsTaskItem;
};

type GeoEditingTaskState = {
  task: LogisticsTaskItem;
  initialQuery?: string;
};

type PendingRouteConfirm =
  | {
      kind: "cancel";
      route: LogisticsRouteRow;
    }
  | {
      kind: "remove-stop";
      route: LogisticsRouteRow;
      stop: LogisticsRouteStopRow;
      shipmentCode: string;
    }
  | {
      kind: "driver";
      route: LogisticsRouteRow;
      nextAssignedTo: string | null;
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

const taskTypeLabel: Record<LogisticsTaskType, string> = {
  deliver_empty_box: "Dejar",
  pickup_full_box: "Recoger",
};

const taskTypeShortLabel: Record<LogisticsTaskType, string> = {
  deliver_empty_box: "Dejar",
  pickup_full_box: "Recoger",
};

const taskActionVerb: Record<LogisticsTaskType, string> = {
  deliver_empty_box: "Entregar",
  pickup_full_box: "Recoger",
};

const routeStatusLabel: Record<LogisticsRouteStatus, string> = {
  draft: "Draft",
  planned: "Planeada",
  cancelled: "Cancelada",
  completed: "Completada",
};

const WIDE_LAYOUT_MEDIA_QUERY = "(min-width: 1536px)";

function useWideLogisticsLayout() {
  const [isWide, setIsWide] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(WIDE_LAYOUT_MEDIA_QUERY);
    const update = () => setIsWide(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isWide;
}

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function formatSchedule(value: string | null) {
  return logisticsScheduleDisplayParts(value).primary;
}

function LogisticsTaskWaitingBanner({
  taskType,
  orderedAt,
  createdAt,
}: {
  taskType: LogisticsTaskType | null | undefined;
  orderedAt: string | null | undefined;
  createdAt: string | null | undefined;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const waiting = logisticsTaskWaitingParts(taskType, orderedAt, createdAt, nowMs);
  if (!waiting) {
    return null;
  }

  return (
    <div
      className={`rounded-md border px-2.5 py-2 ${logisticsWaitingToneClass(waiting.elapsedMs)}`}
    >
      <p className="text-base font-black tabular-nums leading-tight">{waiting.waitingText}</p>
    </div>
  );
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

function taskTypeIcon(taskType: LogisticsTaskType, className = "h-4 w-4") {
  return taskType === "deliver_empty_box" ? (
    <PackageOpen className={className} aria-hidden />
  ) : (
    <PackageCheck className={className} aria-hidden />
  );
}

function invoiceActionLabel(taskType: LogisticsTaskType) {
  return taskActionVerb[taskType];
}

const LOGISTICS_FIELD_BASE = "border-black bg-surface-inset";

function invoiceActionFieldClass(_taskType: LogisticsTaskType) {
  return `${LOGISTICS_FIELD_BASE} text-slate-200`;
}

function invoiceDriverFieldClass(assignedTo: string | null | undefined, hasTask: boolean) {
  if (!hasTask) {
    return `${LOGISTICS_FIELD_BASE} text-slate-400`;
  }

  return assignedTo
    ? `${LOGISTICS_FIELD_BASE} text-slate-200`
    : "logistics-unassigned-alert border-rose-500/90 bg-rose-950/50 text-rose-50";
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
  const searchParams = useSearchParams();
  const isWideLayout = useWideLogisticsLayout();
  const appliedDeepLinkRef = useRef(false);
  const supabaseReady = isSupabaseConfigured();
  const [shipments, setShipments] = useState<ShipmentRow[]>(initialShipments || []);
  const [routeMembers, setRouteMembers] = useState<RouteMemberRow[]>(initialRouteMembers || []);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>(initialWarehouses || []);
  const [routes, setRoutes] = useState<LogisticsRouteRow[]>(initialRoutes || []);
  const [vehicles, setVehicles] = useState<LogisticsVehicleRow[]>([]);
  const [taskAddresses, setTaskAddresses] = useState<LogisticsTaskAddressRow[]>(
    initialTaskAddresses || [],
  );
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [driverFilter, setDriverFilter] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [failedFilter, setFailedFilter] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [advancedRoutesOpen, setAdvancedRoutesOpen] = useState(false);
  const [routeDetailDrawerOpen, setRouteDetailDrawerOpen] = useState(false);
  const [highlightTaskId, setHighlightTaskId] = useState<string | null>(null);
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
  const [pendingDriverChange, setPendingDriverChange] = useState<PendingDriverChange | null>(null);
  const [editingTask, setEditingTask] = useState<EditingTaskState | null>(null);
  const [reprogrammingTask, setReprogrammingTask] = useState<ReprogrammingTaskState | null>(null);
  const [geoEditingTask, setGeoEditingTask] = useState<GeoEditingTaskState | null>(null);
  const [pendingRouteConfirm, setPendingRouteConfirm] = useState<PendingRouteConfirm | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (isWideLayout) {
        setRouteDetailDrawerOpen(false);
        return;
      }

      if (selectedRouteId) {
        setRouteDetailDrawerOpen(true);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isWideLayout, selectedRouteId]);

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
    const vehiclesResult = await listLogisticsVehiclesAction();
    if (vehiclesResult.ok) {
      setVehicles(vehiclesResult.data);
    }
    await Promise.all([reloadShipments(), reloadRoutesAndAddresses()]);
  }

  const reloadAllRef = useRef(reloadAll);
  reloadAllRef.current = reloadAll;

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
          vehiclesResult,
        ] = await Promise.all([
          listShipmentsAction(),
          listRouteMembersAction(),
          listWarehousesAction(),
          listLogisticsRoutesAction(),
          listLogisticsTaskAddressesAction(),
          listLogisticsVehiclesAction(),
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

        if (vehiclesResult.ok) {
          setVehicles(vehiclesResult.data);
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

  useEffect(() => {
    if (!loaded || !supabaseReady) {
      return;
    }

    const refresh = () => {
      if (shouldRunLogisticsLiveRefresh()) {
        void reloadAllRef.current().then(() => notify.info("Board actualizado"));
      }
    };

    const interval = window.setInterval(refresh, LOGISTICS_LIVE_REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loaded, notify, supabaseReady]);

  const memberById = useMemo(() => {
    return new Map(routeMembers.map((member) => [member.id, member.label]));
  }, [routeMembers]);

  const taskDriverPickerOptions = useMemo(
    () => buildDriverPickerOptions(routeMembers, "Sin asignar"),
    [routeMembers],
  );

  const routeDriverPickerOptions = useMemo(
    () => buildDriverPickerOptions(routeMembers, "Sin chofer"),
    [routeMembers],
  );

  const routeVehiclePickerOptions = useMemo(
    () =>
      vehicles
        .filter((vehicle) => vehicle.isActive)
        .map((vehicle) => ({
          value: vehicle.id,
          label: vehicle.plate ? `${vehicle.name} · ${vehicle.plate}` : vehicle.name,
          searchText: `${vehicle.name} ${vehicle.plate}`,
        })),
    [vehicles],
  );

  const pendingRouteDialogCopy = useMemo(() => {
    if (!pendingRouteConfirm) {
      return null;
    }

    if (pendingRouteConfirm.kind === "cancel") {
      return resolveRouteConfirmCopy(
        {
          kind: "cancel",
          routeName: pendingRouteConfirm.route.name,
          stopCount: pendingRouteConfirm.route.stops.length,
        },
        memberById,
      );
    }

    if (pendingRouteConfirm.kind === "remove-stop") {
      return resolveRouteConfirmCopy(
        {
          kind: "remove-stop",
          shipmentCode: pendingRouteConfirm.shipmentCode,
        },
        memberById,
      );
    }

    return resolveRouteConfirmCopy(
      {
        kind: "driver",
        routeName: pendingRouteConfirm.route.name,
        currentAssignedTo: pendingRouteConfirm.route.assignedTo,
        nextAssignedTo: pendingRouteConfirm.nextAssignedTo,
      },
      memberById,
    );
  }, [memberById, pendingRouteConfirm]);

  const filterDriverPickerOptions = useMemo(
    () => buildDriverPickerOptions(routeMembers, "Todo chofer"),
    [routeMembers],
  );

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

  const invoiceItems = useMemo<LogisticsInvoiceItem[]>(() => {
    return shipments
      .map((shipment) => {
        const quote = quoteFromShipment(shipment);
        const tasks = shipment.logisticsTasks.map((task) => ({
          ...task,
          shipment,
          quote,
        }));
        const step = resolveLogisticsInvoiceStep({
          empty_box_delivered_at: shipment.empty_box_delivered_at,
          logistics_plan: shipment.logistics_plan,
          logisticsTasks: tasks,
        });

        if (!step) {
          return null;
        }

        return {
          shipment,
          quote,
          step,
          currentTask: step.currentTask,
          nextTask: step.nextTask,
        };
      })
      .filter((item): item is LogisticsInvoiceItem => Boolean(item));
  }, [shipments]);

  const invoiceStepByTaskId = useMemo(() => {
    const map = new Map<string, LogisticsInvoiceStep<LogisticsTaskItem>>();

    invoiceItems.forEach((item) => {
      if (item.currentTask) {
        map.set(item.currentTask.id, item.step);
      }
      if (item.nextTask) {
        map.set(item.nextTask.id, item.step);
      }
    });

    return map;
  }, [invoiceItems]);

  const taskSearchOptions = useMemo(
    () =>
      invoiceItems.map((item) => {
        const task = item.currentTask || item.nextTask;
        const address = task ? addressByTaskId.get(task.id) : undefined;

        return {
          value: item.shipment.id,
          label: `${item.shipment.code} - ${item.shipment.customer_name}`,
          searchText: [
            item.shipment.code,
            item.shipment.customer_name,
            item.shipment.customerPhone,
            item.shipment.country,
            item.shipment.carrier,
            task ? taskTypeLabel[item.step.stepType] : null,
            task ? formatLogisticsTaskStatusLabel(task.status, task.assignedTo, memberById) : null,
            item.quote?.label,
            task?.notes,
            memberById.get(task?.assignedTo || ""),
            address?.zoneLabel,
            address?.address.formattedAddress,
          ]
            .filter(Boolean)
            .join(" "),
        };
      }),
    [addressByTaskId, invoiceItems, memberById],
  );

  const zoneOptions = useMemo(() => {
    const zones = new Map<string, string>();
    taskAddresses.forEach((address) => zones.set(address.zoneKey, address.zoneLabel));
    return Array.from(zones.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [taskAddresses]);

  const filteredInvoiceItems = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    const cleanType = typeFilter.trim();
    const cleanDriver = driverFilter.trim();
    const cleanWarehouse = warehouseFilter.trim();
    const cleanZone = zoneFilter.trim();

    return sortLogisticsInvoiceItemsByPriority(
      invoiceItems.filter((item) => {
        const task = item.currentTask;
        const fallbackTask = item.currentTask || item.nextTask;
        const address = fallbackTask ? addressByTaskId.get(fallbackTask.id) : undefined;
        const routeInfo = task ? routeByTaskId.get(task.id) : undefined;
        const dateMatches =
          !dateFilter || Boolean(task?.scheduledAt && task.scheduledAt.slice(0, 10) === dateFilter);
        const haystack = [
          item.shipment.code,
          item.shipment.customer_name,
          item.shipment.customerPhone,
          item.shipment.country,
          item.shipment.carrier,
          item.shipment.invoice_priority ? "prioridad" : null,
          taskTypeLabel[item.step.stepType],
          fallbackTask?.notes,
          item.quote?.label,
          memberById.get(task?.assignedTo || ""),
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
          (!cleanType || item.step.stepType === cleanType) &&
          (!cleanDriver || task?.assignedTo === cleanDriver || routeInfo?.route.assignedTo === cleanDriver) &&
          (!cleanWarehouse || task?.warehouseId === cleanWarehouse || routeInfo?.route.warehouseId === cleanWarehouse) &&
          (!cleanZone || address?.zoneKey === cleanZone)
        );
      }),
    );
  }, [
    addressByTaskId,
    dateFilter,
    driverFilter,
    invoiceItems,
    memberById,
    query,
    routeByTaskId,
    typeFilter,
    warehouseFilter,
    zoneFilter,
  ]);

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
        task.shipment.customerPhone,
        task.shipment.country,
        task.shipment.carrier,
        taskTypeLabel[task.taskType],
        formatLogisticsTaskStatusLabel(task.status, task.assignedTo, memberById),
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
    () =>
      prioritizeLogisticsTasks(
        openTasks.filter((task) => {
          const step = invoiceStepByTaskId.get(task.id);
          return step?.currentTask?.id === task.id && !routeByTaskId.has(task.id);
        }),
        {
          missingGeo: (task) => !addressByTaskId.get(task.id)?.hasGeo,
          shipment: (task) => task.shipment,
        },
      ),
    [addressByTaskId, invoiceStepByTaskId, openTasks, routeByTaskId],
  );

  const failedTasks = useMemo(
    () =>
      filteredTasks.filter((task) => isLogisticsFailedTask(task) && !routeByTaskId.has(task.id)),
    [filteredTasks, routeByTaskId],
  );

  useEffect(() => {
    if (!loaded || appliedDeepLinkRef.current) {
      return;
    }

    const shipmentCode = searchParams.get("q")?.trim();
    if (!shipmentCode) {
      return;
    }

    appliedDeepLinkRef.current = true;
    const focus = resolveLogisticsShipmentDeepLink(shipmentCode, allTasks, routeByTaskId);

    const frame = window.requestAnimationFrame(() => {
      setQuery(focus.query);
      if (focus.clearDateFilter) {
        setDateFilter("");
      }
      if (focus.routeId) {
        setSelectedRouteId(focus.routeId);
      }
      if (focus.highlightTaskId) {
        setHighlightTaskId(focus.highlightTaskId);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [allTasks, loaded, routeByTaskId, searchParams]);

  useEffect(() => {
    if (!highlightTaskId) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const element = document.querySelector(`[data-logistics-task-id="${highlightTaskId}"]`);
      element?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    const timeout = window.setTimeout(() => {
      setHighlightTaskId(null);
    }, 4000);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [highlightTaskId, unroutedTasks, selectedRouteId]);

  const filteredRoutes = useMemo(() => {
    return routes
      .filter((route) => route.status !== "cancelled" && route.status !== "completed")
      .filter((route) => !dateFilter || route.routeDate === dateFilter)
      .filter((route) => !driverFilter || route.assignedTo === driverFilter)
      .filter((route) => !warehouseFilter || route.warehouseId === warehouseFilter)
      .filter((route) => !zoneFilter || route.zoneKey === zoneFilter)
      .sort((a, b) => a.routeDate.localeCompare(b.routeDate) || a.name.localeCompare(b.name));
  }, [dateFilter, driverFilter, routes, warehouseFilter, zoneFilter]);

  const selectedRoute = useMemo(() => {
    return routes.find((route) => route.id === selectedRouteId) || filteredRoutes[0] || null;
  }, [filteredRoutes, routes, selectedRouteId]);

  const openCount = filteredInvoiceItems.length;
  const hasFilters = Boolean(
    query.trim() || dateFilter || typeFilter || driverFilter || warehouseFilter || zoneFilter || failedFilter,
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

  async function saveTaskEdit(
    patch: {
      scheduledAt: string | null;
      warehouseId: string | null;
      notes: string;
    },
  ) {
    if (!editingTask) {
      return;
    }

    await changeTask(editingTask.task, patch);
    setEditingTask(null);
  }

  function requestDriverChange(task: LogisticsTaskItem, nextAssignedTo: string | null) {
    if (nextAssignedTo === task.assignedTo) {
      return;
    }

    if (shouldConfirmDriverChange(task.assignedTo, nextAssignedTo)) {
      setPendingDriverChange({ task, nextAssignedTo });
      return;
    }

    void saveDriverChange(task, nextAssignedTo);
  }

  async function saveDriverChange(task: LogisticsTaskItem, nextAssignedTo: string | null) {
    setBusyId(task.id);
    const result = await updateLogisticsTaskAction({
      taskId: task.id,
      assignedTo: nextAssignedTo,
    });

    if (!result.ok) {
      notify.error(result.error);
      setBusyId(null);
      return false;
    }

    await reloadAll();
    setBusyId(null);
    notify.success("Chofer actualizado");
    return true;
  }

  async function confirmDriverChange() {
    if (!pendingDriverChange) {
      return;
    }

    const { task, nextAssignedTo } = pendingDriverChange;
    const saved = await saveDriverChange(task, nextAssignedTo);
    if (saved) {
      setPendingDriverChange(null);
    }
  }

  function cancelDriverChange() {
    if (busyId === pendingDriverChange?.task.id) {
      return;
    }

    setPendingDriverChange(null);
  }

  function canChangeTaskDriver(task: LogisticsTaskItem, routeInfo?: { route: LogisticsRouteRow }) {
    if (task.status === "completed" || task.status === "cancelled") {
      return false;
    }

    const invoiceStep = invoiceStepByTaskId.get(task.id);
    if (invoiceStep && (invoiceStep.currentTask?.id !== task.id || !invoiceStep.canAssignDriver)) {
      return false;
    }

    if (routeInfo) {
      return false;
    }

    if (busyId === task.id) {
      return false;
    }

    return true;
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

  function requestRemoveStop(stop: LogisticsRouteStopRow) {
    if (!selectedRoute) {
      return;
    }

    const task = taskById.get(stop.taskId);
    const shipmentCode = task?.shipment.code || stop.address.name || stop.taskId;
    setPendingRouteConfirm({
      kind: "remove-stop",
      route: selectedRoute,
      stop,
      shipmentCode,
    });
  }

  async function confirmPendingRouteAction() {
    if (!pendingRouteConfirm) {
      return;
    }

    if (pendingRouteConfirm.kind === "cancel") {
      await cancelRoute(pendingRouteConfirm.route);
      setPendingRouteConfirm(null);
      return;
    }

    if (pendingRouteConfirm.kind === "remove-stop") {
      await removeStop(pendingRouteConfirm.stop);
      setPendingRouteConfirm(null);
      return;
    }

    await assignRoute(
      pendingRouteConfirm.route.id,
      pendingRouteConfirm.nextAssignedTo,
    );
    setPendingRouteConfirm(null);
  }

  function cancelPendingRouteAction() {
    if (
      pendingRouteConfirm?.kind === "cancel" &&
      busyId === `cancel:${pendingRouteConfirm.route.id}`
    ) {
      return;
    }

    if (
      pendingRouteConfirm?.kind === "remove-stop" &&
      busyId === `remove:${pendingRouteConfirm.stop.id}`
    ) {
      return;
    }

    if (
      pendingRouteConfirm?.kind === "driver" &&
      busyId === `driver:${pendingRouteConfirm.route.id}`
    ) {
      return;
    }

    setPendingRouteConfirm(null);
  }

  function requestRouteDriverChange(nextAssignedTo: string | null) {
    if (!selectedRoute || nextAssignedTo === (selectedRoute.assignedTo || null)) {
      return;
    }

    setPendingRouteConfirm({
      kind: "driver",
      route: selectedRoute,
      nextAssignedTo,
    });
  }

  function requestCancelRoute(route: LogisticsRouteRow) {
    setPendingRouteConfirm({ kind: "cancel", route });
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

  async function assignRouteVehicle(routeId: string, vehicleId: string | null) {
    setBusyId(`vehicle:${routeId}`);
    const result = await assignLogisticsRouteVehicleAction({ routeId, vehicleId });
    setBusyId(null);

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    await reloadAll();
    notify.success("Vehiculo actualizado");
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
    setRouteDetailDrawerOpen(false);
    await reloadAll();
    notify.success("Ruta cancelada");
  }

  function selectRoute(routeId: string) {
    setSelectedRouteId(routeId);
    if (!isWideLayout) {
      setRouteDetailDrawerOpen(true);
    }
  }

  function closeRouteDetailDrawer() {
    setRouteDetailDrawerOpen(false);
  }

  function renderInvoiceCard(item: LogisticsInvoiceItem) {
    const task = item.currentTask;
    const nextTask = item.nextTask;
    const displayTask = task || nextTask;
    const address = displayTask ? addressByTaskId.get(displayTask.id) : undefined;
    const routeInfo = task ? routeByTaskId.get(task.id) : undefined;
    const highlighted =
      highlightTaskId === task?.id || Boolean(nextTask && highlightTaskId === nextTask.id);
    const missingGeo = Boolean(displayTask && !address?.hasGeo);
    const canChangeDriver = task ? canChangeTaskDriver(task, routeInfo) : false;
    const priorityCardClass = logisticsPriorityCardClass(
      item.shipment.invoice_priority,
      task?.assignedTo,
      Boolean(task),
    );
    const priorityHeaderClass = logisticsPriorityHeaderClass(
      item.shipment.invoice_priority,
      task?.assignedTo,
      Boolean(task),
    );
    const priorityAwaitingDriver = logisticsPriorityAwaitingDriver(
      item.shipment.invoice_priority,
      task?.assignedTo,
      Boolean(task),
    );

    return (
      <article
        key={item.shipment.id}
        data-logistics-task-id={task?.id || nextTask?.id || item.shipment.id}
        className={`rounded-lg border bg-surface-card shadow-[0_6px_18px_rgba(0,0,0,0.18)] ${priorityCardClass} ${highlighted ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#1a2320]" : ""}`}
      >
        <div className={`relative border-b border-black px-3 py-2.5 ${priorityHeaderClass}`}>
          {item.shipment.invoice_priority ? (
            <div className="absolute right-2 top-2 z-10">
              <InvoicePriorityBadge variant="chip" pulsing={priorityAwaitingDriver} />
            </div>
          ) : null}
          <div className={`mx-auto min-w-0 text-center ${item.shipment.invoice_priority ? "pr-14" : ""}`}>
            <p className="truncate text-base font-black text-[#f8fafc]">
              <span className="truncate">{item.shipment.code}</span>
            </p>
            <p className="truncate text-xs font-black text-slate-300">
              {item.shipment.customer_name}
            </p>
            {item.shipment.customerPhone ? (
              <p className="mt-0.5 inline-flex max-w-full items-center justify-center gap-1 truncate text-[11px] font-black text-slate-400">
                <Phone className="h-3 w-3 shrink-0" />
                <span className="truncate">{item.shipment.customerPhone}</span>
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
              <CountryName name={item.shipment.country} size="xs" labelClassName={textMutedClass} />
              {missingGeo ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-700/70 bg-amber-400/15 px-2 py-0.5 text-[10px] font-black text-amber-100">
                  <AlertTriangle className="h-3 w-3" />
                  Falta geo
                </span>
              ) : null}
              {routeInfo ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-black bg-surface-inset px-2 py-0.5 text-[10px] font-black text-emerald-300">
                  <Route className="h-3 w-3" />
                  {routeInfo.route.name}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-3">
          <p
            className={`line-clamp-2 rounded-md border px-2 py-1 text-xs font-bold leading-snug ${
              missingGeo
                ? "border-amber-700 bg-amber-400/15 text-amber-100"
                : "border-black bg-surface-inset text-slate-300"
            }`}
          >
            {address?.address.formattedAddress || displayTask?.notes || "Sin direccion"}
          </p>

          <LogisticsTaskWaitingBanner
            taskType={task?.taskType ?? item.step.stepType}
            orderedAt={task?.orderedAt}
            createdAt={task?.createdAt}
          />

          <div className="grid gap-2 sm:grid-cols-2">
            <div
              className={`relative flex items-center gap-2.5 rounded-md border px-2 py-2 ${invoiceActionFieldClass(item.step.stepType)}`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${logisticsActionIconWellClass(item.step.stepType)}`}
                aria-hidden
              >
                {taskTypeIcon(item.step.stepType, "h-5 w-5")}
              </span>
              <div className="min-w-0">
                <span className="pointer-events-none block text-[10px] font-black uppercase opacity-70">
                  Accion
                </span>
                <span className="pointer-events-none block truncate text-sm font-black">
                  {invoiceActionLabel(item.step.stepType)}
                </span>
              </div>
            </div>

            <div
              className={`relative grid gap-1 rounded-md border px-2 py-2 ${invoiceDriverFieldClass(task?.assignedTo, Boolean(task))}`}
            >
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-black uppercase ${
                  task && !task.assignedTo ? "text-rose-400" : "opacity-70"
                }`}
              >
                <Truck className="h-3.5 w-3.5" />
                Chofer
              </span>
              {task ? (
                <InlineSearchPicker
                  className="w-full min-w-0"
                  minWidthClass="w-full min-w-0"
                  shellClassName={LOGISTICS_CARD_PICKER_SHELL}
                  value={task.assignedTo || ""}
                  onChange={(nextValue) => requestDriverChange(task, nextValue || null)}
                  options={taskDriverPickerOptions}
                  placeholder="Sin chofer"
                  searchPlaceholder="Buscar chofer…"
                  emptyLabel="Sin conductores"
                  ariaLabel={`Chofer de ${item.shipment.code}`}
                  disabled={!canChangeDriver}
                  formatSelectedLabel={(option) => option?.label || "Sin chofer"}
                />
              ) : (
                <span className="truncate text-sm font-black">Primero entrega</span>
              )}
              {task && busyId === task.id ? (
                <Loader2 className="pointer-events-none absolute right-2 top-2 h-3.5 w-3.5 animate-spin text-emerald-300" />
              ) : null}
            </div>
          </div>

          {task && canEditLogisticsTaskFields(task) ? (
            <button
              type="button"
              className={`${secondaryButtonClass} h-9 w-full text-xs`}
              disabled={busyId === task.id}
              onClick={() => setEditingTask({ task })}
            >
              <Pencil className="h-4 w-4" />
              Editar tarea
            </button>
          ) : null}

          {item.quote?.label ? (
            <p className="rounded-md border border-black bg-[#26312c] px-3 py-2 text-center text-sm font-black tabular-nums tracking-tight text-[#f8fafc] sm:text-base">
              {item.quote.label}
            </p>
          ) : null}
        </div>
      </article>
    );
  }

  function renderTaskCard(
    task: LogisticsTaskItem,
    mode: "unrouted" | "route" | "failed" = "unrouted",
  ) {
    const address = addressByTaskId.get(task.id);
    const routeInfo = routeByTaskId.get(task.id);
    const missingGeo = mode === "unrouted" && !address?.hasGeo;
    const highlighted = highlightTaskId === task.id;
    const warehouseLabel = task.warehouseId
      ? warehouseById.get(task.warehouseId) || task.warehouseId
      : "Default";
    const canAdd =
      mode === "unrouted" &&
      selectedRoute &&
      selectedRoute.status !== "cancelled" &&
      selectedRoute.status !== "completed" &&
      address?.hasGeo;
    const showChoferPicker = mode === "unrouted";
    const showFailedActions = mode === "failed";
    const priorityHeaderClass = logisticsPriorityHeaderClass(
      task.shipment.invoice_priority,
      task.assignedTo,
      true,
    );
    const priorityAwaitingDriver = logisticsPriorityAwaitingDriver(
      task.shipment.invoice_priority,
      task.assignedTo,
      true,
    );

    return (
      <article
        key={task.id}
        data-logistics-task-id={task.id}
        className={logisticsUnroutedTaskCardClass({
          missingGeo,
          highlighted,
          invoicePriority: task.shipment.invoice_priority,
          assignedTo: task.assignedTo,
          canAssignDriver: true,
        })}
      >
        <div
          className={`relative border-b border-black px-3 py-2 ${
            missingGeo ? "bg-amber-950/55" : priorityHeaderClass
          }`}
        >
          {task.shipment.invoice_priority ? (
            <div className="absolute right-2 top-2 z-10">
              <InvoicePriorityBadge variant="chip" pulsing={priorityAwaitingDriver} />
            </div>
          ) : null}
          <div className={`flex items-start justify-between gap-2 ${task.shipment.invoice_priority ? "pr-14" : ""}`}>
            <div className="min-w-0">
              <p className="truncate text-base font-black text-[#f8fafc]">
                <span className="truncate">{task.shipment.code}</span>
              </p>
              <p className="truncate text-xs font-black text-slate-300">
                {task.shipment.customer_name}
              </p>
              {task.shipment.customerPhone ? (
                <p className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-[11px] font-black text-slate-400">
                  <Phone className="h-3 w-3 shrink-0" />
                  <span className="truncate">{task.shipment.customerPhone}</span>
                </p>
              ) : null}
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
            <LogisticsTaskStatusBadge
              status={task.status}
              assignedTo={task.assignedTo}
              memberById={memberById}
              routeMembers={routeMembers}
              disabled={!canChangeTaskDriver(task, routeInfo)}
              shipmentCode={task.shipment.code}
              onDriverChangeRequest={(nextAssignedTo) =>
                requestDriverChange(task, nextAssignedTo)
              }
              statusBadgeClass={statusBadgeClass}
            />
            {!address?.hasGeo ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-700/70 bg-amber-400/15 px-2 py-0.5 text-[10px] font-black text-amber-100">
                <AlertTriangle className="h-3 w-3" />
                Falta geo
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-2 p-3">
          {missingGeo ? (
            <button
              type="button"
              className={`${secondaryButtonClass} h-9 w-full text-xs`}
              onClick={() =>
                setGeoEditingTask({
                  task,
                  initialQuery:
                    address?.address.formattedAddress || task.notes || task.shipment.customer_name,
                })
              }
            >
              <MapPin className="h-4 w-4" />
              Corregir direccion
            </button>
          ) : null}
          <p
            className={`line-clamp-2 rounded-md border px-2 py-1 text-xs font-bold leading-snug ${
              missingGeo
                ? "border-amber-700 bg-amber-400/15 text-amber-100"
                : "border-black bg-surface-inset text-slate-300"
            }`}
          >
            {missingGeo
              ? address?.address.formattedAddress || task.notes || "Sin geolocalizacion para ruta"
              : address?.address.formattedAddress || task.notes || "Sin direccion para ruta"}
          </p>

          <LogisticsTaskWaitingBanner
            taskType={task.taskType}
            orderedAt={task.orderedAt}
            createdAt={task.createdAt}
          />

          {showChoferPicker ? (
            <div className="relative grid gap-1 rounded-md border border-black bg-[#26312c] px-2 py-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-slate-500">
                  <Truck className="h-3.5 w-3.5 text-emerald-300" />
                  Chofer
                </span>
                <InlineSearchPicker
                  className="w-full min-w-0"
                  minWidthClass="w-full min-w-0"
                  shellClassName={LOGISTICS_CARD_PICKER_SHELL}
                  value={task.assignedTo || ""}
                  onChange={(nextValue) => requestDriverChange(task, nextValue || null)}
                  options={taskDriverPickerOptions}
                  placeholder="Sin asignar"
                  searchPlaceholder="Buscar chofer…"
                  emptyLabel="Sin conductores"
                  ariaLabel="Chofer"
                  disabled={!canChangeTaskDriver(task, routeInfo)}
                  formatSelectedLabel={(option) =>
                    option?.label || driverLabel(task.assignedTo, memberById)
                  }
                />
              </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-black text-slate-500">
              <Warehouse className="h-3.5 w-3.5" />
              {warehouseLabel}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {showFailedActions ? (
                <button
                  type="button"
                  className={`${primaryButtonClass} h-9 px-3 text-xs`}
                  disabled={busyId === task.id}
                  onClick={() => setReprogrammingTask({ task })}
                >
                  Reprogramar
                </button>
              ) : null}
              {canEditLogisticsTaskFields(task) && !showFailedActions ? (
                <button
                  type="button"
                  className={`${secondaryButtonClass} h-9 px-3 text-xs`}
                  disabled={busyId === task.id}
                  onClick={() => setEditingTask({ task })}
                >
                  <Pencil className="h-4 w-4" />
                  Editar
                </button>
              ) : null}
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
        </div>
      </article>
    );
  }

  function renderRouteDetailContent(options?: { scrollClass?: string; showTitle?: boolean }) {
    const scrollClass = options?.scrollClass ?? "max-h-[70vh]";
    const showTitle = options?.showTitle ?? true;

    return (
      <>
        <div className="border-b border-black bg-surface-card-header px-3 py-3">
          {showTitle ? (
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
          ) : null}

          {selectedRoute ? (
            <div className={`grid gap-2 ${showTitle ? "mt-3" : ""}`}>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <InlineSearchPicker
                className="w-full min-w-0"
                minWidthClass="w-full min-w-0"
                compact={false}
                value={selectedRoute.assignedTo || ""}
                onChange={(nextValue) => requestRouteDriverChange(nextValue || null)}
                options={routeDriverPickerOptions}
                placeholder="Sin chofer"
                searchPlaceholder="Buscar chofer…"
                emptyLabel="Sin conductores"
                ariaLabel="Chofer de ruta"
                disabled={busyId === `driver:${selectedRoute.id}`}
                leadingIcon={<Truck className="h-4 w-4 text-emerald-300" aria-hidden />}
              />
              <button
                type="button"
                className={`${secondaryButtonClass} h-11 justify-center text-rose-200 disabled:opacity-50`}
                disabled={
                  busyId === `cancel:${selectedRoute.id}` ||
                  (selectedRoute.status !== "draft" && selectedRoute.status !== "planned")
                }
                onClick={() => requestCancelRoute(selectedRoute)}
              >
                {busyId === `cancel:${selectedRoute.id}` ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Cancelar
              </button>
              </div>
              {routeVehiclePickerOptions.length ? (
                <InlineSearchPicker
                  className="w-full min-w-0"
                  minWidthClass="w-full min-w-0"
                  compact={false}
                  value={selectedRoute.vehicleId || ""}
                  onChange={(nextValue) =>
                    void assignRouteVehicle(selectedRoute.id, nextValue || null)
                  }
                  options={routeVehiclePickerOptions}
                  placeholder="Sin vehiculo"
                  searchPlaceholder="Buscar vehiculo…"
                  emptyLabel="Sin vehiculos"
                  ariaLabel="Vehiculo de ruta"
                  disabled={busyId === `vehicle:${selectedRoute.id}`}
                  leadingIcon={<Boxes className="h-4 w-4 text-emerald-300" aria-hidden />}
                />
              ) : null}
            </div>
          ) : null}
        </div>

        <div className={`grid ${scrollClass} gap-3 overflow-y-auto p-3`}>
          {selectedRoute?.stops.length ? (
            selectedRoute.stops.map((stop, index) => {
              const task = taskById.get(stop.taskId);
              const highlighted = highlightTaskId === stop.taskId;

              return (
                <article
                  key={stop.id}
                  data-logistics-task-id={stop.taskId}
                  className={`relative rounded-lg border border-black bg-surface-card p-3 ${
                    highlighted ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#1a2320]" : ""
                  }`}
                >
                  {task?.shipment.invoice_priority ? (
                    <div className="absolute right-2 top-2 z-10">
                      <InvoicePriorityBadge
                        variant="chip"
                        pulsing={logisticsPriorityAwaitingDriver(
                          task.shipment.invoice_priority,
                          task.assignedTo,
                          true,
                        )}
                      />
                    </div>
                  ) : null}
                  <div
                    className={`flex items-start justify-between gap-2 ${task?.shipment.invoice_priority ? "pr-14" : ""}`}
                  >
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
                        {formatEtaMinutes(estimateRouteStopEtaMinutes(index + 1)) ? (
                          <p className="truncate text-[11px] font-bold text-slate-500">
                            ETA ~{formatEtaMinutes(estimateRouteStopEtaMinutes(index + 1))}
                          </p>
                        ) : null}
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
                        onClick={() => requestRemoveStop(stop)}
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
                      <LogisticsTaskStatusBadge
                        status={task.status}
                        assignedTo={task.assignedTo}
                        memberById={memberById}
                        routeMembers={routeMembers}
                        disabled={!canChangeTaskDriver(task, { route: selectedRoute })}
                        shipmentCode={task.shipment.code}
                        onDriverChangeRequest={(nextAssignedTo) =>
                          requestDriverChange(task, nextAssignedTo)
                        }
                        statusBadgeClass={statusBadgeClass}
                      />
                      <span className="rounded-md border border-black bg-surface-inset px-2 py-1 text-[11px] font-black text-slate-400">
                        {formatSchedule(task.scheduledAt)}
                      </span>
                      {canEditLogisticsTaskFields(task) ? (
                        <button
                          type="button"
                          className={`${secondaryButtonClass} h-8 px-2.5 text-[11px]`}
                          disabled={busyId === task.id}
                          onClick={() => setEditingTask({ task })}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </button>
                      ) : null}
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
      </>
    );
  }

  const routeDetailDrawer =
    typeof document !== "undefined" && routeDetailDrawerOpen && selectedRoute && !isWideLayout ? (
      <div className="fixed inset-0 z-[135] flex justify-end 2xl:hidden">
        <button
          type="button"
          className="absolute inset-0 bg-black/50"
          aria-label="Cerrar detalle de ruta"
          onClick={closeRouteDetailDrawer}
        />
        <aside className="relative flex h-full w-full max-w-lg flex-col border-l border-black bg-[#1a2320] shadow-[-20px_0_50px_rgba(0,0,0,0.45)]">
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-black/70 px-4 py-4">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                Logistica
              </p>
              <h2 className="truncate text-lg font-black text-[#f8fafc]">{selectedRoute.name}</h2>
              <p className="mt-0.5 text-sm font-bold text-slate-400">
                {selectedRoute.routeDate} · {selectedRoute.stops.length} paradas
              </p>
            </div>
            <button
              type="button"
              onClick={closeRouteDetailDrawer}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black bg-[#111827] text-slate-300"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-hidden">
            {renderRouteDetailContent({ scrollClass: "h-full max-h-none", showTitle: false })}
          </div>
        </aside>
      </div>
    ) : null;

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
          <div className={`${cardClass} overflow-visible p-2`}>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-9 shrink-0 divide-x divide-black overflow-hidden rounded-lg border border-black bg-surface-inset">
                <div className="flex min-w-[5rem] items-center gap-1.5 px-2">
                  <span className="text-[9px] font-black uppercase leading-none text-slate-500">
                    Invoices
                  </span>
                  <span className="text-sm font-black tabular-nums leading-none text-[#f8fafc]">
                    {openCount}
                  </span>
                </div>
              </div>

              <InlineSearchCombobox
                value={query}
                onChange={setQuery}
                options={taskSearchOptions}
                placeholder="Buscar invoice, cliente, ruta"
                emptyLabel="Sin tareas"
                ariaLabel="Buscar tareas de logistica"
                leadingIcon={<Search className="h-4 w-4" aria-hidden />}
                className="min-w-[14rem] flex-[1_1_18rem]"
                minWidthClass="w-full min-w-0"
                onSelectOption={(option) => {
                  const item = invoiceItems.find((entry) => entry.shipment.id === option.value);
                  if (item) {
                    setQuery(item.shipment.code);
                  }
                }}
              />

              <DateInput
                className="w-[8.5rem] shrink-0"
                value={dateFilter}
                ariaLabel="Fecha"
                onChange={setDateFilter}
              />

              <select
                className="h-9 w-[8rem] shrink-0 rounded-lg border border-black bg-surface-inset px-2.5 text-sm font-black text-[#f8fafc] outline-none"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                aria-label="Filtrar por tipo de tarea"
              >
                <option value="">Todo tipo</option>
                <option value="deliver_empty_box">Dejar</option>
                <option value="pickup_full_box">Recoger</option>
              </select>

              <InlineSearchPicker
                className="w-[9rem] shrink-0"
                minWidthClass="w-full min-w-0"
                value={driverFilter}
                onChange={setDriverFilter}
                options={filterDriverPickerOptions}
                placeholder="Todo chofer"
                searchPlaceholder="Buscar chofer…"
                emptyLabel="Sin conductores"
                ariaLabel="Filtrar por chofer"
                leadingIcon={<Truck className="h-4 w-4 text-emerald-300" aria-hidden />}
              />

              <select
                className="h-9 w-[9rem] shrink-0 rounded-lg border border-black bg-surface-inset px-2.5 text-sm font-black text-[#f8fafc] outline-none"
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
                className="h-9 w-[8rem] shrink-0 rounded-lg border border-black bg-surface-inset px-2.5 text-sm font-black text-[#f8fafc] outline-none"
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

              <button
                type="button"
                className={`${secondaryButtonClass} h-9 shrink-0 px-2.5 text-xs ${
                  failedFilter ? "ring-2 ring-amber-500/70" : ""
                }`}
                onClick={() => setFailedFilter((current) => !current)}
              >
                Fallidas
                {failedTasks.length ? (
                  <span className="rounded-full border border-black bg-surface-inset px-1.5 py-0.5 text-[10px] font-black">
                    {failedTasks.length}
                  </span>
                ) : null}
              </button>

              <button
                type="button"
                className={`${secondaryButtonClass} h-9 shrink-0 px-2.5 disabled:opacity-50`}
                disabled={!hasFilters}
                onClick={() => {
                  setQuery("");
                  setDateFilter("");
                  setTypeFilter("");
                  setDriverFilter("");
                  setWarehouseFilter("");
                  setZoneFilter("");
                  setFailedFilter(false);
                }}
              >
                <XCircle className="h-4 w-4" />
                Limpiar
              </button>

              <LogisticsSectionNav
                active="routes"
                className="ml-auto"
                routesOnClick={() => setAdvancedRoutesOpen((current) => !current)}
                extraActions={
                  advancedRoutesOpen ? (
                    <button
                      type="button"
                      className={`${primaryButtonClass} h-9 shrink-0 px-2.5 disabled:opacity-50`}
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
                  ) : null
                }
              />
            </div>
          </div>

          <LogisticsKpisStrip routes={routes} tasks={allTasks} />

          <LogisticsEvidenceGallery />

          <section className="overflow-hidden rounded-xl border border-black bg-surface-panel">
            <div className="grid max-h-[72vh] auto-rows-max gap-3 overflow-y-auto p-3 xl:grid-cols-2 2xl:grid-cols-3">
              {filteredInvoiceItems.length ? (
                filteredInvoiceItems.map((item) => renderInvoiceCard(item))
              ) : (
                <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-black bg-surface-inset px-4 text-center">
                  <div>
                    <ClipboardList className="mx-auto h-7 w-7 text-slate-600" />
                    <p className="mt-2 text-sm font-black text-slate-300">Sin invoices</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {advancedRoutesOpen && suggestions.length ? (
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

          {advancedRoutesOpen ? (
          <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-[minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1.05fr)_minmax(22rem,0.8fr)]">
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
                {failedFilter && failedTasks.length ? (
                  <div className="grid gap-2">
                    <p className="text-xs font-black uppercase text-amber-300">Fallidas</p>
                    {failedTasks.map((task) => renderTaskCard(task, "failed"))}
                  </div>
                ) : null}
                {unroutedTasks.length ? (
                  unroutedTasks.map((task) => renderTaskCard(task))
                ) : !failedFilter || !failedTasks.length ? (
                  <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-black bg-surface-inset px-4 text-center">
                    <div>
                      <ClipboardList className="mx-auto h-7 w-7 text-slate-600" />
                      <p className="mt-2 text-sm font-black text-slate-300">Sin tareas sueltas</p>
                    </div>
                  </div>
                ) : null}
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
                  <div className="flex shrink-0 items-center gap-2">
                    {!isWideLayout && selectedRoute ? (
                      <button
                        type="button"
                        className={`${secondaryButtonClass} h-8 px-2.5 text-[11px]`}
                        onClick={() => setRouteDetailDrawerOpen(true)}
                      >
                        Ver detalle
                      </button>
                    ) : null}
                    <span className="rounded-md border border-black bg-surface-inset px-2 py-1 text-sm font-black text-slate-200">
                      {filteredRoutes.length}
                    </span>
                  </div>
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
                      onClick={() => selectRoute(route.id)}
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

            <section className="hidden overflow-hidden rounded-xl border border-black bg-surface-panel 2xl:block">
              {renderRouteDetailContent()}
            </section>

            <section className="overflow-hidden rounded-xl border border-black bg-surface-panel lg:col-span-2 2xl:col-span-1">
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
          ) : null}
        </div>
      ) : null}

      {routeDetailDrawer ? createPortal(routeDetailDrawer, document.body) : null}

      <LogisticsAddressGeoEditor
        open={Boolean(geoEditingTask)}
        taskId={geoEditingTask?.task.id || ""}
        shipmentCode={geoEditingTask?.task.shipment.code || ""}
        initialQuery={geoEditingTask?.initialQuery}
        onCancel={() => setGeoEditingTask(null)}
        onSaved={async () => {
          setGeoEditingTask(null);
          await reloadAll();
          notify.success("Direccion actualizada");
        }}
      />

      <LogisticsTaskReprogramPanel
        open={Boolean(reprogrammingTask)}
        shipmentCode={reprogrammingTask?.task.shipment.code || ""}
        customerName={reprogrammingTask?.task.shipment.customer_name || ""}
        taskTypeLabel={
          reprogrammingTask ? taskTypeLabel[reprogrammingTask.task.taskType] : ""
        }
        task={
          reprogrammingTask?.task || {
            id: "",
            status: "cancelled",
            scheduledAt: null,
            warehouseId: null,
            notes: "",
            assignedTo: null,
          }
        }
        warehouses={warehouses}
        routeMembers={routeMembers}
        onCancel={() => setReprogrammingTask(null)}
        onSaved={async () => {
          setReprogrammingTask(null);
          await reloadAll();
          notify.success("Tarea reprogramada");
        }}
      />

      <LogisticsTaskEditPanel
        open={Boolean(editingTask)}
        shipmentCode={editingTask?.task.shipment.code || ""}
        customerName={editingTask?.task.shipment.customer_name || ""}
        taskTypeLabel={
          editingTask ? taskTypeLabel[editingTask.task.taskType] : ""
        }
        task={
          editingTask?.task || {
            status: "pending",
            scheduledAt: null,
            warehouseId: null,
            notes: "",
          }
        }
        warehouses={warehouses}
        saving={editingTask ? busyId === editingTask.task.id : false}
        onCancel={() => setEditingTask(null)}
        onSave={saveTaskEdit}
      />

      <LogisticsDriverChangeDialog
        open={Boolean(pendingDriverChange)}
        shipmentCode={pendingDriverChange?.task.shipment.code || ""}
        customerName={pendingDriverChange?.task.shipment.customer_name || ""}
        taskTypeLabel={
          pendingDriverChange ? taskTypeLabel[pendingDriverChange.task.taskType] : ""
        }
        currentAssignedTo={pendingDriverChange?.task.assignedTo || null}
        nextAssignedTo={pendingDriverChange?.nextAssignedTo ?? null}
        memberById={memberById}
        confirming={
          pendingDriverChange ? busyId === pendingDriverChange.task.id : false
        }
        onCancel={cancelDriverChange}
        onConfirm={() => void confirmDriverChange()}
      />

      <ActionConfirmDialog
        open={Boolean(pendingRouteConfirm && pendingRouteDialogCopy)}
        dialogId="logistics-route-confirm"
        title={pendingRouteDialogCopy?.title || ""}
        message={pendingRouteDialogCopy?.message || ""}
        confirmLabel={pendingRouteDialogCopy?.confirmLabel}
        tone={pendingRouteDialogCopy?.tone}
        confirming={
          pendingRouteConfirm?.kind === "cancel"
            ? busyId === `cancel:${pendingRouteConfirm.route.id}`
            : pendingRouteConfirm?.kind === "remove-stop"
              ? busyId === `remove:${pendingRouteConfirm.stop.id}`
              : pendingRouteConfirm?.kind === "driver"
                ? busyId === `driver:${pendingRouteConfirm.route.id}`
                : false
        }
        onCancel={cancelPendingRouteAction}
        onConfirm={() => void confirmPendingRouteAction()}
      />
    </Panel>
  );
}
