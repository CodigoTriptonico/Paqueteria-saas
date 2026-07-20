"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Loader2,
  PackageCheck,
  PackageOpen,
  Pencil,
  Phone,
  Boxes,
  PlusCircle,
  Route,
  Search,
  SlidersHorizontal,
  Trash2,
  Truck,
  X,
  XCircle,
} from "lucide-react";
import {
  addLogisticsRouteStopAction,
  assignLogisticsRouteDriverAction,
  assignLogisticsRouteVehicleAction,
  assignLogisticsTaskToRouteFromPickerAction,
  cancelLogisticsRouteAction,
  confirmLogisticsTaskScheduleAction,
  listLogisticsRouteCatalogAction,
  listLogisticsRoutesAction,
  listLogisticsTaskAddressesAction,
  removeLogisticsRouteStopAction,
  reorderLogisticsRouteStopsAction,
  type LogisticsRouteCatalog as LogisticsRouteCatalogData,
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
import { LogisticsDriverChangeDialog } from "@/components/logistica/logistics-driver-change-dialog";
import { LogisticsRouteCatalog } from "@/components/logistica/logistics-route-catalog";
import { LogisticsTaskEditPanel } from "@/components/logistica/logistics-task-edit-panel";
import { LogisticsTaskReprogramPanel } from "@/components/logistica/logistics-task-reprogram-panel";
import { LogisticsTaskScheduleConfirmPanel } from "@/components/logistica/logistics-task-schedule-confirm-panel";
import { LogisticsSectionNav } from "@/components/logistica/logistics-section-nav";
import { AgencyLogisticsPanel } from "@/components/logistica/agency-logistics-panel";
import { LogisticsTaskStatusBadge } from "@/components/logistica/logistics-task-status-badge";
import { InlineSearchCombobox, InlineSearchPicker } from "@/components/inline-search-picker";
import { PageLoading } from "@/components/page-loading";
import { SupabaseRequiredBanner } from "@/components/supabase-required-banner";
import {
  listCardShellClass,
  listRowBaseClass,
  listRowHoverClass,
  Panel,
  panelListScrollClass,
  panelListStackClass,
  panelToolbarClass,
  primaryButtonClass,
  secondaryButtonClass,
  textMutedClass,
} from "@/components/ui-blocks";
import { useNotify } from "@/hooks/use-notify";
import { usePageViewLayout } from "@/components/ui/ui-surface-preferences-provider";
import {
  buildDriverPickerOptions,
  buildTaskRoutePickerOptions,
  formatLogisticsTaskStatusLabel,
  logisticsScheduleDisplayParts,
  logisticsActionIconWellClass,
  logisticsPriorityCardClass,
  logisticsPriorityHeaderClass,
  logisticsPriorityAwaitingDriver,
  logisticsTaskWaitingParts,
  logisticsWaitingToneClass,
  resolveLogisticsInvoiceStep,
  sortLogisticsInvoiceItemsByPriority,
  resolveLogisticsShipmentDeepLink,
  resolveRouteConfirmCopy,
  shouldConfirmDriverChange,
  taskRoutePickerDate,
  type LogisticsInvoiceStep,
} from "@/lib/logistics-view";
import { canEditLogisticsTaskFields } from "@/lib/logistics-task-edit";
import { estimateRouteStopEtaMinutes, formatEtaMinutes } from "@/lib/logistics-eta";
import { isLogisticsFailedTask } from "@/lib/logistics-reprogram";
import { LOGISTICS_LIVE_REFRESH_MS, shouldRunLogisticsLiveRefresh } from "@/lib/logistics-live-refresh";
import { quoteFromShipment, readShipmentBoxLines, type ShipmentQuote } from "@/lib/shipment-display";
import { ShipmentBoxLinesTrigger } from "@/components/shipment-box-lines-trigger";
import { formatScheduleDateInput, scheduledAtToLocalDateInput } from "@/lib/schedule-date";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { WarehouseRow } from "@/lib/auth/types";
import type {
  LogisticsRouteRow,
  LogisticsRouteStatus,
  LogisticsRouteStopRow,
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
  "inset-shell box-border inline-flex h-7 w-full min-w-0 items-center gap-1.5 rounded-md border-0 bg-transparent px-0";

const LOGISTICS_INVOICE_CARD_GRID_CLASS =
  "grid auto-rows-max gap-3 xl:grid-cols-2 2xl:grid-cols-3";

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

type ConfirmingScheduleTaskState = {
  task: LogisticsTaskItem;
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
  in_progress: "En curso",
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

function formatSchedule(value: string | null) {
  return logisticsScheduleDisplayParts(value).primary;
}

function formatTaskDate(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  const localDate = scheduledAtToLocalDateInput(value);
  if (!localDate) {
    return "Sin fecha";
  }

  const [year, month, day] = localDate.split("-").map(Number);
  if (!year || !month || !day) {
    return "Sin fecha";
  }

  const label = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day, 12));

  return label.charAt(0).toUpperCase() + label.slice(1);
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

function invoiceEvidenceLabel(shipment: ShipmentRow) {
  const evidence = shipment.invoiceBoxEvidence;

  if (evidence?.incidentBoxes) {
    return { label: "Invoice no visible", tone: "border-rose-700/70 bg-rose-400/15 text-rose-100" };
  }

  if (evidence && evidence.markedBoxes === evidence.totalBoxes) {
    return { label: "Invoice confirmado", tone: "border-emerald-700/70 bg-emerald-400/15 text-emerald-100" };
  }

  return { label: "Invoice por confirmar", tone: "border-amber-700/70 bg-amber-400/15 text-amber-100" };
}

const LOGISTICS_FIELD_BASE = "border-black bg-surface-inset";

function invoiceActionFieldClass() {
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

export function LogisticaClient({
  initialShipments,
  initialRouteMembers,
  initialWarehouses,
  initialRoutes,
  initialTaskAddresses,
  initialRouteCatalog,
  canManageRoutes = false,
  agencyModuleEnabled = false,
}: {
  initialShipments?: ShipmentRow[];
  initialRouteMembers?: RouteMemberRow[];
  initialWarehouses?: WarehouseRow[];
  initialRoutes?: LogisticsRouteRow[];
  initialTaskAddresses?: LogisticsTaskAddressRow[];
  initialRouteCatalog?: LogisticsRouteCatalogData;
  canManageRoutes?: boolean;
  agencyModuleEnabled?: boolean;
}) {
  const notify = useNotify();
  const { layout: viewLayout } = usePageViewLayout("logistics.tasks");
  const searchParams = useSearchParams();
  const isRoutesView = searchParams.get("view") === "rutas";
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
  const [routeCatalog, setRouteCatalog] = useState<LogisticsRouteCatalogData | undefined>(
    initialRouteCatalog,
  );
  const [query, setQuery] = useState("");
  const [todayDate] = useState(() => formatScheduleDateInput(new Date()));
  const [dateFilter, setDateFilter] = useState(() => formatScheduleDateInput(new Date()));
  const [typeFilter, setTypeFilter] = useState("");
  const [driverFilter, setDriverFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [failedFilter, setFailedFilter] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [operationScope, setOperationScope] = useState<"domicilios" | "agencias">("domicilios");
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [routeDetailDrawerOpen, setRouteDetailDrawerOpen] = useState(false);
  const [highlightTaskId, setHighlightTaskId] = useState<string | null>(null);
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
  const [confirmingScheduleTask, setConfirmingScheduleTask] = useState<ConfirmingScheduleTaskState | null>(null);
  const [pendingRouteConfirm, setPendingRouteConfirm] = useState<PendingRouteConfirm | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [routeAssignmentOpen, setRouteAssignmentOpen] = useState(false);


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

  const reloadShipments = useCallback(async () => {
    const result = await listShipmentsAction();
    if (result.ok) {
      setShipments(result.data);
    } else {
      notify.error(result.error);
    }
  }, [notify]);

  const reloadRoutesAndAddresses = useCallback(async () => {
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
  }, [notify]);

  const reloadRouteCatalog = useCallback(async () => {
    const result = await listLogisticsRouteCatalogAction();
    if (result.ok) {
      setRouteCatalog(result.data);
    }
  }, []);

  const reloadAll = useCallback(async () => {
    const vehiclesResult = await listLogisticsVehiclesAction();
    if (vehiclesResult.ok) {
      setVehicles(vehiclesResult.data);
    }
    await Promise.all([reloadShipments(), reloadRoutesAndAddresses(), reloadRouteCatalog()]);
  }, [reloadRouteCatalog, reloadRoutesAndAddresses, reloadShipments]);

  useEffect(() => {
    queueMicrotask(() => {
      void reloadRouteCatalog();
    });
  }, [reloadRouteCatalog]);

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
          catalogResult,
        ] = await Promise.all([
          listShipmentsAction(),
          listRouteMembersAction(),
          listWarehousesAction(),
          listLogisticsRoutesAction(),
          listLogisticsTaskAddressesAction(),
          listLogisticsVehiclesAction(),
          listLogisticsRouteCatalogAction(),
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

        if (catalogResult.ok) {
          setRouteCatalog(catalogResult.data);
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
        void reloadAll().then(() => notify.info("Board actualizado"));
      }
    };

    const interval = window.setInterval(refresh, LOGISTICS_LIVE_REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loaded, notify, reloadAll, supabaseReady]);

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
    const cleanZone = zoneFilter.trim();

    return sortLogisticsInvoiceItemsByPriority(
      invoiceItems.filter((item) => {
        const task = item.currentTask;
        const fallbackTask = item.currentTask || item.nextTask;
        const address = fallbackTask ? addressByTaskId.get(fallbackTask.id) : undefined;
        const routeInfo = task ? routeByTaskId.get(task.id) : undefined;
        const dateMatches =
          !dateFilter ||
          Boolean(
            task?.scheduledAt &&
              scheduledAtToLocalDateInput(task.scheduledAt) === dateFilter,
          );
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
    zoneFilter,
  ]);

  const filteredTasks = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    const cleanType = typeFilter.trim();
    const cleanDriver = driverFilter.trim();
    const cleanZone = zoneFilter.trim();

    return allTasks.filter((task) => {
      const address = addressByTaskId.get(task.id);
      const routeInfo = routeByTaskId.get(task.id);
        const dateMatches =
          !dateFilter ||
          Boolean(
            task.scheduledAt &&
              scheduledAtToLocalDateInput(task.scheduledAt) === dateFilter,
          );
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
    zoneFilter,
  ]);

  const failedTasks = useMemo(
    () =>
      filteredTasks.filter((task) => isLogisticsFailedTask(task) && !routeByTaskId.has(task.id)),
    [filteredTasks, routeByTaskId],
  );

  const failedInvoiceItems = useMemo<LogisticsInvoiceItem[]>(() => {
    return failedTasks.map((task) => ({
      shipment: task.shipment,
      quote: task.quote,
      step: {
        stepType: task.taskType,
        currentTask: task,
        nextTask: null,
        emptyBoxDone: false,
        pickupReady: false,
        canAssignDriver: false,
        assignment: "unassigned",
      },
      currentTask: task,
      nextTask: null,
    }));
  }, [failedTasks]);

  const visibleInvoiceItems = useMemo(
    () => (failedFilter ? failedInvoiceItems : filteredInvoiceItems),
    [failedFilter, failedInvoiceItems, filteredInvoiceItems],
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
  }, [filteredInvoiceItems, highlightTaskId, selectedRouteId]);

  const filteredRoutes = useMemo(() => {
    return routes
      .filter((route) => route.status !== "cancelled" && route.status !== "completed")
      .filter((route) => !dateFilter || route.routeDate === dateFilter)
      .filter((route) => !driverFilter || route.assignedTo === driverFilter)
      .filter((route) => !zoneFilter || route.zoneKey === zoneFilter)
      .sort((a, b) => a.routeDate.localeCompare(b.routeDate) || a.name.localeCompare(b.name));
  }, [dateFilter, driverFilter, routes, zoneFilter]);

  const selectedRoute = useMemo(() => {
    return routes.find((route) => route.id === selectedRouteId) || filteredRoutes[0] || null;
  }, [filteredRoutes, routes, selectedRouteId]);

  const hasFilters = Boolean(
    query.trim() || dateFilter !== todayDate || typeFilter || driverFilter || zoneFilter || failedFilter,
  );
  const selectedTasks = useMemo(
    () => allTasks.filter((task) => selectedTaskIds.includes(task.id)),
    [allTasks, selectedTaskIds],
  );
  const assignableRoutes = useMemo(
    () => routes.filter((route) => route.status === "draft" || route.status === "planned"),
    [routes],
  );

  function taskCanBeSelectedForRoute(task: LogisticsTaskItem, routeInfo?: { route: LogisticsRouteRow }) {
    return !routeInfo && task.status !== "completed" && task.status !== "cancelled";
  }

  function toggleTaskSelection(task: LogisticsTaskItem, routeInfo?: { route: LogisticsRouteRow }) {
    if (!taskCanBeSelectedForRoute(task, routeInfo)) {
      return;
    }

    setSelectedTaskIds((current) =>
      current.includes(task.id) ? current.filter((id) => id !== task.id) : [...current, task.id],
    );
  }

  async function assignSelectedTasksToRoute(route: LogisticsRouteRow) {
    if (!selectedTasks.length) {
      return;
    }

    setBusyId(`assign-selection:${route.id}`);
    const results = await Promise.all(
      selectedTasks.map((task) => addLogisticsRouteStopAction({ routeId: route.id, taskId: task.id })),
    );
    setBusyId(null);

    const failed = results.find((result) => !result.ok);
    if (failed && !failed.ok) {
      notify.error(failed.error);
      return;
    }

    await reloadAll();
    setSelectedTaskIds([]);
    setRouteAssignmentOpen(false);
    notify.success(`${selectedTasks.length} tareas asignadas a ${route.name}`);
  }

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
      return false;
    }

    await reloadAll();
    setBusyId(null);
    notify.success("Tarea actualizada");
    return true;
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

    const previousDate = scheduledAtToLocalDateInput(editingTask.task.scheduledAt);
    const saved = await changeTask(editingTask.task, patch);

    if (!saved) {
      return;
    }

    setEditingTask(null);

    const nextDate = scheduledAtToLocalDateInput(patch.scheduledAt);
    if (nextDate && nextDate !== previousDate && dateFilter === previousDate) {
      setDateFilter(nextDate);
    }
  }

  async function confirmTaskSchedule(input: {
    scheduledAt: string;
    driverId: string;
    routeTemplateId: string;
  }) {
    if (!confirmingScheduleTask) return;

    const task = confirmingScheduleTask.task;
    setBusyId(`confirm:${task.id}`);
    const result = await confirmLogisticsTaskScheduleAction({
      taskId: task.id,
      ...input,
    });
    setBusyId(null);

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    setConfirmingScheduleTask(null);
    setSelectedRouteId(result.data.id);
    await reloadAll();
    notify.success("Tarea confirmada y agregada a la ruta");
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

  function canChangeTaskRoute(
    task: LogisticsTaskItem,
    routeInfo?: { route: LogisticsRouteRow; stop: LogisticsRouteStopRow },
    hasGeo = true,
  ) {
    if (!canManageRoutes || !canEditLogisticsTaskFields(task)) {
      return false;
    }

    if (task.status === "completed" || task.status === "cancelled") {
      return false;
    }

    if (routeInfo && routeInfo.route.status !== "draft" && routeInfo.route.status !== "planned") {
      return false;
    }

    if (!routeInfo && !hasGeo) {
      return false;
    }

    if (busyId === task.id || busyId === `route:${task.id}`) {
      return false;
    }

    return true;
  }

  function routePickerOptionsForTask(task: LogisticsTaskItem) {
    return buildTaskRoutePickerOptions({
      routes: assignableRoutes.map((route) => ({
        id: route.id,
        name: route.name,
        routeDate: route.routeDate,
        routeTemplateId: route.routeTemplateId,
        assignedTo: route.assignedTo,
        status: route.status,
      })),
      templates: routeCatalog?.templates || [],
      enabledWeekdays: routeCatalog?.enabledDays || [],
      taskDate: taskRoutePickerDate(task.scheduledAt, dateFilter || todayDate),
      driverLabelById: memberById,
    });
  }

  function parseRoutePickerValue(value: string) {
    if (!value) {
      return null;
    }

    if (value.startsWith("template:")) {
      return { routeTemplateId: value.slice("template:".length) };
    }

    if (value.startsWith("route:")) {
      return { routeId: value.slice("route:".length) };
    }

    return { routeId: value };
  }

  function routePickerValueForTask(routeInfo?: { route: LogisticsRouteRow }) {
    return routeInfo ? `route:${routeInfo.route.id}` : "";
  }

  async function saveTaskRouteChange(
    task: LogisticsTaskItem,
    nextSelection: string,
    routeInfo?: { route: LogisticsRouteRow; stop: LogisticsRouteStopRow },
  ) {
    const parsed = parseRoutePickerValue(nextSelection);

    if (!parsed) {
      return;
    }

    setBusyId(`route:${task.id}`);

    if (routeInfo && routeInfo.route.id !== parsed.routeId) {
      const removeResult = await removeLogisticsRouteStopAction({
        routeId: routeInfo.route.id,
        stopId: routeInfo.stop.id,
      });

      if (!removeResult.ok) {
        notify.error(removeResult.error);
        setBusyId(null);
        return;
      }
    }

    const assignResult = await assignLogisticsTaskToRouteFromPickerAction({
      taskId: task.id,
      routeId: parsed.routeId,
      routeTemplateId: parsed.routeTemplateId,
      routeDate: taskRoutePickerDate(task.scheduledAt, dateFilter || todayDate),
    });
    setBusyId(null);

    if (!assignResult.ok) {
      notify.error(assignResult.error);
      await reloadAll();
      return;
    }

    setSelectedRouteId(assignResult.data.id);
    await reloadAll();
    notify.success(routeInfo ? "Ruta actualizada" : "Tarea asignada a la ruta");
  }

  function requestTaskRouteChange(
    task: LogisticsTaskItem,
    nextSelection: string | null,
    routeInfo?: { route: LogisticsRouteRow; stop: LogisticsRouteStopRow },
  ) {
    const currentSelection = routePickerValueForTask(routeInfo);

    if ((nextSelection || "") === currentSelection) {
      return;
    }

    if (routeInfo && !nextSelection) {
      requestRemoveStop(routeInfo.route, routeInfo.stop);
      return;
    }

    if (!nextSelection) {
      return;
    }

    void saveTaskRouteChange(task, nextSelection, routeInfo);
  }

  function renderTaskRoutePicker(
    task: LogisticsTaskItem,
    routeInfo: { route: LogisticsRouteRow; stop: LogisticsRouteStopRow } | undefined,
    shipmentCode: string,
    className = "w-[10rem] shrink-0",
  ) {
    const hasGeo = Boolean(addressByTaskId.get(task.id)?.hasGeo);

    return (
      <InlineSearchPicker
        className={className}
        minWidthClass="w-full min-w-0"
        shellClassName={LOGISTICS_CARD_PICKER_SHELL}
        value={routePickerValueForTask(routeInfo)}
        onChange={(nextValue) => requestTaskRouteChange(task, nextValue || null, routeInfo)}
        options={routePickerOptionsForTask(task)}
        placeholder="Sin ruta"
        searchPlaceholder="Buscar ruta…"
        emptyLabel="Sin rutas para ese día"
        ariaLabel={`Ruta de ${shipmentCode}`}
        disabled={!canChangeTaskRoute(task, routeInfo, hasGeo)}
        formatSelectedLabel={(option) => option?.label || "Sin ruta"}
      />
    );
  }

  async function removeStop(route: LogisticsRouteRow, stop: LogisticsRouteStopRow) {
    setBusyId(`remove:${stop.id}`);
    const result = await removeLogisticsRouteStopAction({
      routeId: route.id,
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

  function requestRemoveStop(route: LogisticsRouteRow, stop: LogisticsRouteStopRow) {
    const task = taskById.get(stop.taskId);
    const shipmentCode = task?.shipment.code || stop.address.name || stop.taskId;
    setPendingRouteConfirm({
      kind: "remove-stop",
      route,
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
      await removeStop(pendingRouteConfirm.route, pendingRouteConfirm.stop);
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
    const isFailed = Boolean(task && isLogisticsFailedTask(task));
    const priorityCardClass = logisticsPriorityCardClass(item.shipment.invoice_priority);
    const priorityHeaderClass = logisticsPriorityHeaderClass(item.shipment.invoice_priority);
    const priorityAwaitingDriver = logisticsPriorityAwaitingDriver(
      item.shipment.invoice_priority,
      task?.assignedTo,
      Boolean(task),
    );
    const invoiceEvidence = invoiceEvidenceLabel(item.shipment);

    return (
      <article
        key={task?.id || item.shipment.id}
        data-logistics-task-id={task?.id || nextTask?.id || item.shipment.id}
        className={`${listCardShellClass} shadow-[0_6px_18px_rgba(0,0,0,0.18)] ${priorityCardClass} ${isFailed ? "border-amber-700/70" : ""} ${highlighted ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#1a2320]" : ""}`}
      >
        <div className={`relative border-b border-black px-3 py-2.5 ${priorityHeaderClass}`}>
          {task && !isFailed && taskCanBeSelectedForRoute(task, routeInfo) ? (
            <label className="absolute left-2 top-2 z-10 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-black bg-surface-inset">
              <input
                type="checkbox"
                className="h-5 w-5 accent-emerald-400"
                checked={selectedTaskIds.includes(task.id)}
                onChange={() => toggleTaskSelection(task, routeInfo)}
                aria-label={`Seleccionar ${item.shipment.code} para asignar a ruta`}
              />
            </label>
          ) : null}
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
              <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-black ${invoiceEvidence.tone}`}>
                <PackageCheck className="h-3 w-3" />
                {invoiceEvidence.label}
              </span>
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
              className={`relative flex items-center gap-2.5 rounded-md border px-2 py-2 ${invoiceActionFieldClass()}`}
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
              {task && isFailed ? (
                <button
                  type="button"
                  className={`${primaryButtonClass} h-9 w-full text-xs`}
                  disabled={busyId === task.id}
                  onClick={() => setReprogrammingTask({ task })}
                >
                  Reprogramar
                </button>
              ) : task ? (
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

          {task && !isFailed ? (
            <div className="relative grid gap-1 rounded-md border border-black bg-surface-inset px-2 py-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-slate-500">
                <Route className="h-3.5 w-3.5" />
                Ruta
              </span>
              {renderTaskRoutePicker(task, routeInfo, item.shipment.code, "w-full shrink-0")}
              {busyId === `route:${task.id}` ? (
                <Loader2 className="pointer-events-none absolute right-2 top-2 h-3.5 w-3.5 animate-spin text-emerald-300" />
              ) : null}
            </div>
          ) : null}

          {task && !isFailed && canEditLogisticsTaskFields(task) && !routeInfo ? (
            <button
              type="button"
              className={`${primaryButtonClass} h-9 w-full text-xs`}
              disabled={busyId === `confirm:${task.id}` || !canManageRoutes}
              onClick={() => setConfirmingScheduleTask({ task })}
            >
              <CalendarDays className="h-4 w-4" />
              Confirmar y programar
            </button>
          ) : null}

          {task && !isFailed && canEditLogisticsTaskFields(task) ? (
            <button
              type="button"
              className={`${secondaryButtonClass} h-9 w-full text-xs`}
              disabled={busyId === task.id}
              onClick={() => setEditingTask({ task })}
            >
              <Pencil className="h-4 w-4" />
              Programar y editar
            </button>
          ) : null}

          {item.quote ? (
            <ShipmentBoxLinesTrigger
              lines={readShipmentBoxLines(item.shipment)}
              variant="card"
            />
          ) : null}
        </div>
      </article>
    );
  }

  function renderInvoiceRow(item: LogisticsInvoiceItem) {
    const task = item.currentTask;
    const nextTask = item.nextTask;
    const displayTask = task || nextTask;
    const address = displayTask ? addressByTaskId.get(displayTask.id) : undefined;
    const routeInfo = task ? routeByTaskId.get(task.id) : undefined;
    const highlighted =
      highlightTaskId === task?.id || Boolean(nextTask && highlightTaskId === nextTask.id);
    const missingGeo = Boolean(displayTask && !address?.hasGeo);
    const canChangeDriver = task ? canChangeTaskDriver(task, routeInfo) : false;
    const isFailed = Boolean(task && isLogisticsFailedTask(task));
    const priorityAwaitingDriver = logisticsPriorityAwaitingDriver(
      item.shipment.invoice_priority,
      task?.assignedTo,
      Boolean(task),
    );
    const invoiceEvidence = invoiceEvidenceLabel(item.shipment);

    return (
      <article
        key={task?.id || item.shipment.id}
        data-logistics-task-id={task?.id || nextTask?.id || item.shipment.id}
        className={`${listRowBaseClass} px-3 py-2 sm:px-4 ${
          highlighted
            ? "bg-emerald-950/25 ring-1 ring-inset ring-emerald-500/50"
            : listRowHoverClass
        } ${isFailed ? "bg-amber-950/25" : ""} ${logisticsPriorityCardClass(item.shipment.invoice_priority)}`}
      >
        <div className="flex w-full min-w-0 flex-col gap-y-2 lg:flex-row lg:items-center lg:gap-x-4">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              {task && !isFailed && taskCanBeSelectedForRoute(task, routeInfo) ? (
                <label className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded border border-black bg-surface-inset">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-emerald-400"
                    checked={selectedTaskIds.includes(task.id)}
                    onChange={() => toggleTaskSelection(task, routeInfo)}
                    aria-label={`Seleccionar ${item.shipment.code} para asignar a ruta`}
                  />
                </label>
              ) : null}
              {item.shipment.invoice_priority ? (
                <InvoicePriorityBadge variant="chip" pulsing={priorityAwaitingDriver} />
              ) : null}
              <span className="text-sm font-black text-[#f8fafc]">{item.shipment.code}</span>
              <span className="truncate text-sm font-bold text-slate-300">{item.shipment.customer_name}</span>
              <span className="inline-flex items-center gap-1 rounded-md border border-black/70 bg-surface-inset px-1.5 py-0.5 text-[10px] font-black uppercase text-slate-300">
                {taskTypeIcon(item.step.stepType, "h-3 w-3")}
                {invoiceActionLabel(item.step.stepType)}
              </span>
              {isFailed ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-amber-200">
                  <AlertTriangle className="h-3 w-3" />
                  Fallida
                </span>
              ) : null}
              {missingGeo ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-200">
                  <AlertTriangle className="h-3 w-3" />
                  Falta geo
                </span>
              ) : null}
              <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-black ${invoiceEvidence.tone}`}>
                <PackageCheck className="h-3 w-3" />
                {invoiceEvidence.label}
              </span>
            </div>
            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-bold leading-snug text-slate-400">
              <span className="line-clamp-1 min-w-0 flex-1">
                {address?.address.formattedAddress || displayTask?.notes || "Sin direccion"}
              </span>
              {item.quote ? (
                <ShipmentBoxLinesTrigger
                  lines={readShipmentBoxLines(item.shipment)}
                  variant="inline"
                />
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-1.5 lg:justify-end">
            {isFailed && task ? (
              <button
                type="button"
                className={`${primaryButtonClass} h-8 shrink-0 whitespace-nowrap px-2.5 text-[10px]`}
                disabled={busyId === task.id}
                onClick={() => setReprogrammingTask({ task })}
              >
                Reprogramar
              </button>
            ) : null}
            {task && !isFailed ? (
              <InlineSearchPicker
                className="w-[9rem] shrink-0"
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
              <span className="text-[11px] font-black text-slate-400">Primero entrega</span>
            )}
            {task && !isFailed ? renderTaskRoutePicker(task, routeInfo, item.shipment.code) : null}
            {task && !isFailed && canEditLogisticsTaskFields(task) && !routeInfo ? (
              <button
                type="button"
                className={`${primaryButtonClass} h-8 shrink-0 whitespace-nowrap px-2.5 text-[10px]`}
                disabled={busyId === `confirm:${task.id}` || !canManageRoutes}
                title="Confirmar fecha, ruta y conductor"
                onClick={() => setConfirmingScheduleTask({ task })}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Programar
              </button>
            ) : null}
            {task && !isFailed && canEditLogisticsTaskFields(task) ? (
              <button
                type="button"
                className={`${secondaryButtonClass} h-8 shrink-0 whitespace-nowrap px-2.5 text-[10px]`}
                title="Cambiar la fecha, hora, bodega o notas"
                onClick={() => setEditingTask({ task })}
              >
                <CalendarDays className="h-3.5 w-3.5 text-emerald-300" />
                {formatTaskDate(task.scheduledAt)}
              </button>
            ) : task ? (
              <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-black bg-surface-inset px-2 text-[10px] font-black text-slate-300">
                <CalendarDays className="h-3.5 w-3.5 text-emerald-300" />
                {formatTaskDate(task.scheduledAt)}
              </span>
            ) : null}
            {task && (busyId === task.id || busyId === `route:${task.id}`) ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-300" />
            ) : null}
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
                        onClick={() => requestRemoveStop(selectedRoute, stop)}
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

  if (isRoutesView) {
    return (
      <Panel title="Logistica" hideHeader clipContent={false}>
        {!supabaseReady ? (
          <SupabaseRequiredBanner detail="La logistica se lee desde shipments, shipment_logistics_tasks y logistics_routes en Supabase." />
        ) : null}
        {supabaseReady ? (
          <div className="grid w-full min-w-0 gap-4">
            <div className={`${panelToolbarClass} flex flex-wrap items-center justify-between gap-3`}>
              <div className="px-1">
                <p className="text-sm font-black text-[#f8fafc]">Rutas semanales</p>
                <p className="mt-0.5 text-xs font-bold text-slate-500">Disponibilidad y recorridos recurrentes.</p>
              </div>
              <LogisticsSectionNav active="routes" className="ml-auto" />
            </div>
            <LogisticsRouteCatalog
              initialCatalog={routeCatalog}
              canManage={canManageRoutes}
              routeMembers={routeMembers}
              onCatalogChange={() => void reloadRouteCatalog()}
            />
          </div>
        ) : null}
      </Panel>
    );
  }

  return (
    <Panel
      title="Logistica"
      hideHeader
      clipContent={false}
      className="flex min-h-0 w-full flex-col lg:flex-1 lg:overflow-hidden"
      contentClassName="flex min-h-0 w-full min-w-0 flex-1 flex-col p-3 sm:p-4"
    >
      {!supabaseReady ? (
        <SupabaseRequiredBanner detail="La logistica se lee desde shipments, shipment_logistics_tasks y logistics_routes en Supabase." />
      ) : null}

      {supabaseReady ? (
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
          <div className={panelToolbarClass}>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-9 shrink-0 rounded-lg border border-black bg-surface-inset p-0.5 text-xs font-black">
                <button type="button" className={`rounded-md px-2.5 ${operationScope === "domicilios" ? "bg-emerald-400 text-slate-950" : "text-slate-300"}`} onClick={() => setOperationScope("domicilios")}>Domicilios</button>
                {agencyModuleEnabled ? <button type="button" className={`rounded-md px-2.5 ${operationScope === "agencias" ? "bg-emerald-400 text-slate-950" : "text-slate-300"}`} onClick={() => setOperationScope("agencias")}>Agencias</button> : null}
              </div>
              {operationScope === "domicilios" ? <>
              <InlineSearchCombobox
                value={query}
                onChange={setQuery}
                options={taskSearchOptions}
                placeholder="Buscar invoice, cliente, ruta"
                emptyLabel="Sin tareas"
                ariaLabel="Buscar tareas de logistica"
                leadingIcon={<Search className="h-4 w-4" aria-hidden />}
                className="min-w-[14rem] flex-[1_1_24rem]"
                minWidthClass="w-full min-w-0"
                onSelectOption={(option) => {
                  const item = invoiceItems.find((entry) => entry.shipment.id === option.value);
                  if (item) {
                    setQuery(item.shipment.code);
                  }
                }}
              />

              <div className="flex shrink-0 items-center gap-1">
                {dateFilter ? (
                  <>
                    <DateInput
                      className="w-[11.5rem] shrink-0 border-emerald-500 bg-emerald-950/50"
                      value={dateFilter}
                      ariaLabel="Fecha"
                      onChange={setDateFilter}
                    />
                    <button
                      type="button"
                      className={`${secondaryButtonClass} h-9 w-9 shrink-0 p-0`}
                      aria-label="Quitar filtro de fecha"
                      title="Ver todas las fechas"
                      onClick={() => setDateFilter("")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className={`${primaryButtonClass} h-9 shrink-0 gap-1.5 px-2.5 text-xs font-black`}
                    aria-label="Mostrando tareas de todas las fechas"
                    title="Mostrando todas las fechas"
                    onClick={() => setDateFilter(todayDate)}
                  >
                    <CalendarDays className="h-4 w-4" />
                    Todas las fechas
                  </button>
                )}
              </div>

              <select
                className={`h-9 min-w-[12rem] shrink-0 rounded-lg border px-2.5 pr-8 text-sm font-black outline-none ${
                  typeFilter
                    ? "border-emerald-500 bg-emerald-950/50 text-emerald-100"
                    : "border-black bg-surface-inset text-[#f8fafc]"
                }`}
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                aria-label="Filtrar tareas por acción"
              >
                <option value="">Todas las tareas</option>
                <option value="deliver_empty_box">Dejar cajas</option>
                <option value="pickup_full_box">Recoger cajas</option>
              </select>

              {selectedTasks.length ? (
                <button
                  type="button"
                  className={`${primaryButtonClass} h-9 shrink-0 px-3 text-xs`}
                  onClick={() => setRouteAssignmentOpen(true)}
                >
                  <Route className="h-4 w-4" />
                  Asignar {selectedTasks.length} a ruta
                </button>
              ) : null}

              <div className="relative shrink-0">
                <button
                  type="button"
                  className={`${filtersOpen || hasFilters ? primaryButtonClass : secondaryButtonClass} h-9 shrink-0 px-2.5 text-xs`}
                  aria-expanded={filtersOpen}
                  onClick={() => setFiltersOpen((current) => !current)}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Filtros
                </button>

                {filtersOpen ? (
                  <div className="absolute left-0 top-full z-[120] mt-2 flex w-max max-w-[calc(100vw-2rem)] flex-wrap items-center gap-2 rounded-xl border border-black bg-surface-card p-2 shadow-[0_16px_36px_rgba(0,0,0,0.45)]">
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
                className={`${failedFilter ? primaryButtonClass : secondaryButtonClass} h-9 shrink-0 px-2.5 text-xs`}
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
                  setDateFilter(todayDate);
                  setTypeFilter("");
                  setDriverFilter("");
                  setZoneFilter("");
                  setFailedFilter(false);
                }}
              >
                <XCircle className="h-4 w-4" />
                Limpiar
              </button>
                </div>
              ) : null}
              </div>



              <LogisticsSectionNav
                active="tasks"
                className="basis-full border-t border-black/70 pt-2 lg:ml-auto lg:basis-auto lg:border-t-0 lg:pt-0"
              />
              </> : <LogisticsSectionNav active="tasks" className="ml-auto" />}
            </div>
          </div>

          <div className={`${panelListScrollClass} pt-3`}>
            {agencyModuleEnabled && operationScope === "agencias" ? <AgencyLogisticsPanel /> : visibleInvoiceItems.length ? (
              viewLayout === "rows" ? (
                <div className={panelListStackClass}>
                  {visibleInvoiceItems.map((item) => renderInvoiceRow(item))}
                </div>
              ) : (
                <div className={LOGISTICS_INVOICE_CARD_GRID_CLASS}>
                  {visibleInvoiceItems.map((item) => renderInvoiceCard(item))}
                </div>
              )
            ) : (
              <div className="flex min-h-40 flex-col items-center justify-center px-4 text-center">
                <ClipboardList className="h-7 w-7 text-slate-600" />
                <p className="mt-2 text-sm font-black text-slate-300">
                  {failedFilter ? "Sin tareas fallidas" : "Sin invoices"}
                </p>
              </div>
            )}
          </div>

        </div>
      ) : null}

      {routeDetailDrawer ? createPortal(routeDetailDrawer, document.body) : null}

      {routeAssignmentOpen ? (
        <div className="fixed inset-0 z-[145] flex items-center justify-center bg-black/70 p-4">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Cerrar asignación de ruta"
            onClick={() => setRouteAssignmentOpen(false)}
          />
          <section className="relative w-full max-w-lg overflow-hidden rounded-xl border border-black bg-surface-panel shadow-2xl">
            <header className="border-b border-black bg-surface-card-header px-4 py-3">
              <p className="text-lg font-black text-[#f8fafc]">Asignar a ruta</p>
              <p className="mt-0.5 text-sm font-bold text-slate-400">
                {selectedTasks.length} invoices seleccionadas. Elige la ruta operativa para agregarlas.
              </p>
            </header>
            <div className="grid max-h-[55dvh] gap-2 overflow-y-auto p-3">
              {assignableRoutes.length ? (
                assignableRoutes.map((route) => (
                  <button
                    key={route.id}
                    type="button"
                    className="flex items-center justify-between gap-3 rounded-lg border border-black bg-surface-card px-3 py-3 text-left transition hover:bg-surface-card-hover disabled:opacity-50"
                    disabled={busyId === `assign-selection:${route.id}`}
                    onClick={() => void assignSelectedTasksToRoute(route)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black text-[#f8fafc]">{route.name}</span>
                      <span className="mt-0.5 block text-xs font-bold text-slate-500">
                        {formatTaskDate(route.routeDate)} · {route.stops.length} paradas
                      </span>
                    </span>
                    {busyId === `assign-selection:${route.id}` ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-300" />
                    ) : (
                      <PlusCircle className="h-4 w-4 shrink-0 text-emerald-300" />
                    )}
                  </button>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-black bg-surface-inset p-5 text-center">
                  <Route className="mx-auto h-7 w-7 text-slate-600" />
                  <p className="mt-2 text-sm font-black text-slate-300">Sin rutas abiertas</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    Crea o abre una ruta operativa antes de asignar estas tareas.
                  </p>
                </div>
              )}
            </div>
            <footer className="border-t border-black p-3">
              <button type="button" className={`${secondaryButtonClass} h-9 px-3 text-xs`} onClick={() => setRouteAssignmentOpen(false)}>
                Cancelar
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {reprogrammingTask ? (
        <LogisticsTaskReprogramPanel
          key={reprogrammingTask.task.id}
          open
          shipmentCode={reprogrammingTask.task.shipment.code}
          customerName={reprogrammingTask.task.shipment.customer_name}
          taskTypeLabel={taskTypeLabel[reprogrammingTask.task.taskType]}
          task={reprogrammingTask.task}
          warehouses={warehouses}
          routeMembers={routeMembers}
          onCancel={() => setReprogrammingTask(null)}
          onSaved={async () => {
            setReprogrammingTask(null);
            await reloadAll();
            notify.success("Tarea reprogramada");
          }}
        />
      ) : null}

      {editingTask ? (
        <LogisticsTaskEditPanel
          key={editingTask.task.id}
          open
          shipmentCode={editingTask.task.shipment.code}
          customerName={editingTask.task.shipment.customer_name}
          taskTypeLabel={taskTypeLabel[editingTask.task.taskType]}
          task={editingTask.task}
          warehouses={warehouses}
          saving={busyId === editingTask.task.id}
          onCancel={() => setEditingTask(null)}
          onSave={saveTaskEdit}
        />
      ) : null}

      <LogisticsTaskScheduleConfirmPanel
        key={confirmingScheduleTask?.task.id || "no-task"}
        open={Boolean(confirmingScheduleTask)}
        shipmentCode={confirmingScheduleTask?.task.shipment.code || ""}
        customerName={confirmingScheduleTask?.task.shipment.customer_name || ""}
        taskTypeLabel={
          confirmingScheduleTask
            ? taskTypeLabel[confirmingScheduleTask.task.taskType]
            : ""
        }
        scheduledAt={confirmingScheduleTask?.task.scheduledAt || null}
        templates={routeCatalog?.templates || []}
        defaultDriverByWeekday={routeCatalog?.defaultDriverByWeekday || Array<string | null>(7).fill(null)}
        routeMembers={routeMembers}
        saving={Boolean(confirmingScheduleTask && busyId === `confirm:${confirmingScheduleTask.task.id}`)}
        onCancel={() => setConfirmingScheduleTask(null)}
        onConfirm={confirmTaskSchedule}
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
