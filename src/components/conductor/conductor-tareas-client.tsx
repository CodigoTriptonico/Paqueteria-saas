"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  DollarSign,
  ListTodo,
  Loader2,
  MapPin,
  PackageCheck,
  Phone,
  RotateCcw,
  RefreshCw,
  WifiOff,
  X,
  XCircle,
} from "lucide-react";
import { ShipmentBoxLinesTrigger } from "@/components/shipment-box-lines-trigger";
import { reactivateConductorTaskAction } from "@/app/actions/conductor-tasks";
import { ActionConfirmDialog } from "@/components/action-confirm-dialog";
import { InlineSearchPicker } from "@/components/inline-search-picker";
import {
  cardClass,
  inputClass,
  listCardShellClass,
  listRowBaseClass,
  listRowHoverClass,
  Panel,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui-blocks";
import { usePageViewLayout } from "@/components/ui/ui-surface-preferences-provider";
import { useNotify } from "@/hooks/use-notify";
import { formatMoneyValue } from "@/lib/logistics-fees";
import { PAYMENT_METHOD_OPTIONS, type PaymentMethod } from "@/lib/payment-methods";
import type { ConductorPaymentChoice } from "@/lib/conductor-driver-payment";
import {
  buildConductorPreviewPickerOptions,
  type ConductorDriverOption,
} from "@/lib/conductor-tareas-view";
import {
  conductorTaskOutcomeLabel,
  conductorTaskStatusClass,
  type ConductorDriverTask,
} from "@/lib/conductor-tasks";
import { summarizeConductorTasks, summarizeConductorCompletedOutcomes } from "@/lib/conductor-dashboard";
import type { LogisticsTaskType } from "@/lib/logistics-routing";
import {
  CONDUCTOR_TASK_FAILURE_REASONS,
  type ConductorTruckInventorySummary,
} from "@/lib/conductor-truck-inventory";
import { buildMapsNavigationUrl } from "@/lib/logistics-navigation";
import { AgencyVisitsPanel } from "@/components/conductor/agency-visits-panel";
import { estimateRouteStopEtaMinutes, formatEtaMinutes } from "@/lib/logistics-eta";
import { buildLogisticaShipmentDeepLink } from "@/lib/logistics-view";
import { formatScheduleAtDisplay } from "@/lib/sale/schedule-time";
import {
  CONDUCTOR_OFFLINE_CHANGED_EVENT,
  cacheConductorOfflineShell,
  enqueueConductorTaskResult,
  flushConductorTaskResults,
  pruneSyncedConductorOperations,
  readConductorOfflineSnapshot,
  removeConductorOperationsForTask,
  requestConductorBackgroundSync,
  requestPersistentConductorStorage,
  retryConductorOfflineOperation,
} from "@/lib/conductor-offline/queue";
import {
  conductorOfflineGlobalLabel,
  conductorOfflineStatusLabel,
  summarizeConductorOfflineOperations,
} from "@/lib/conductor-offline/queue-core";
import type {
  ConductorOfflineOperation,
  ConductorOfflineScope,
} from "@/lib/conductor-offline/types";

type ConductorTareasClientProps = {
  canPreview?: boolean;
  drivers?: ConductorDriverOption[];
  previewDriverId?: string | null;
  effectiveDriverId?: string | null;
  effectiveDriverLabel: string;
  organizationId: string;
  userId: string;
  initialTasks?: ConductorDriverTask[];
  initialCompletedTasks?: ConductorDriverTask[];
  initialTruckSummary?: ConductorTruckInventorySummary | null;
};

type TaskListMode = "pending" | "completed";

type TaskDialogState = {
  task: ConductorDriverTask;
  result: "completed" | "failed";
};

type ConductorTaskItemProps = {
  task: ConductorDriverTask;
  isCompletedView: boolean;
  successDisabled: boolean;
  outcomeLabel: string;
  syncOperation?: ConductorOfflineOperation;
  onOpenDialog: (task: ConductorDriverTask, result: "completed" | "failed") => void;
  onReactivate: (task: ConductorDriverTask) => void;
  onRetrySync: (operationId: string) => void;
};

function ConductorTaskSyncBadge({
  operation,
  onRetry,
}: {
  operation: ConductorOfflineOperation;
  onRetry: (operationId: string) => void;
}) {
  const needsAttention = operation.status === "needs_attention";
  const tone = needsAttention
    ? "border-rose-800/70 bg-rose-950/35 text-rose-200"
    : operation.status === "synced"
      ? "border-emerald-800/70 bg-emerald-950/35 text-emerald-200"
      : "border-amber-800/70 bg-amber-950/30 text-amber-200";

  if (needsAttention) {
    return (
      <button
        type="button"
        className={`inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2 text-[11px] font-black ${tone}`}
        title={operation.lastError || undefined}
        onClick={() => onRetry(operation.id)}
      >
        <RefreshCw className="h-3.5 w-3.5" />
        {conductorOfflineStatusLabel(operation)}
      </button>
    );
  }

  return (
    <span className={`inline-flex min-h-8 items-center rounded-md border px-2 text-[11px] font-black ${tone}`}>
      {conductorOfflineStatusLabel(operation)}
    </span>
  );
}

function CompactInfoDisclosure({
  ariaLabel,
  children,
  align = "left",
  tone = "slate",
}: {
  ariaLabel: string;
  children: ReactNode;
  align?: "left" | "right";
  tone?: "sky" | "slate";
}) {
  return (
    <details className="group relative shrink-0">
      <summary
        aria-label={ariaLabel}
        className={`flex h-6 w-6 cursor-pointer list-none items-center justify-center rounded-full border text-xs font-black transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden ${
          tone === "sky"
            ? "border-sky-500/60 text-sky-200 hover:border-sky-300 hover:bg-sky-900/60 hover:text-white focus-visible:outline-sky-300"
            : "border-slate-600 text-slate-300 hover:border-slate-400 hover:bg-surface-inset hover:text-white focus-visible:outline-slate-300"
        }`}
      >
        !
      </summary>
      <div
        className={`fixed inset-x-4 top-1/2 z-30 max-w-none -translate-y-1/2 rounded-lg border border-black bg-surface-panel px-3 py-2.5 text-sm font-bold leading-snug text-slate-200 shadow-xl sm:absolute sm:inset-x-auto sm:top-full sm:mt-2 sm:w-72 sm:max-w-[calc(100vw-2rem)] sm:translate-y-0 ${
          align === "right" ? "sm:right-0" : "sm:left-0"
        }`}
      >
        {children}
      </div>
    </details>
  );
}

function ConductorTaskRecipientPeek({
  task,
  className = "",
}: {
  task: Pick<
    ConductorDriverTask,
    "recipientName" | "recipientCountry" | "recipientPhone" | "recipientCity"
  >;
  className?: string;
}) {
  const hasRecipient =
    task.recipientName || task.recipientCountry || task.recipientPhone || task.recipientCity;

  if (!hasRecipient) {
    return null;
  }

  return (
    <div className={className}>
      <CompactInfoDisclosure ariaLabel="Ver destinatario" align="right">
        <p className="mb-1 text-xs font-black uppercase tracking-wide text-slate-500">Destinatario</p>
        {task.recipientName ? <p className="font-black text-slate-100">{task.recipientName}</p> : null}
        {task.recipientCity || task.recipientCountry ? (
          <p className="text-slate-400">
            {[task.recipientCity, task.recipientCountry].filter(Boolean).join(", ")}
          </p>
        ) : null}
        {task.recipientPhone ? (
          <a href={`tel:${task.recipientPhone}`} className="text-sky-300 hover:text-sky-200">
            {task.recipientPhone}
          </a>
        ) : null}
      </CompactInfoDisclosure>
    </div>
  );
}

function ConductorTaskSenderSummary({
  task,
  layout,
}: {
  task: Pick<ConductorDriverTask, "senderName" | "senderPhone">;
  layout: "card" | "row";
}) {
  if (layout === "card") {
    return (
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Remitente</p>
        <p className="truncate text-sm font-black text-slate-100">{task.senderName}</p>
        {task.senderPhone ? (
          <p className="mt-0.5 inline-flex max-w-full items-center justify-center gap-1 truncate text-[11px] font-black text-slate-400">
            <Phone className="h-3 w-3 shrink-0" />
            <span className="truncate">{task.senderPhone}</span>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="text-[11px] font-black uppercase text-slate-500">Remitente</span>
      <span className="truncate text-sm font-bold text-slate-100">{task.senderName}</span>
      {task.senderPhone ? (
        <span className="inline-flex max-w-full items-center gap-1 truncate text-[11px] font-bold text-slate-400">
          <Phone className="h-3 w-3 shrink-0" />
          <span className="truncate">{task.senderPhone}</span>
        </span>
      ) : null}
    </div>
  );
}

function ConductorTaskBoxSummary({
  task,
  compact = false,
  className = "",
}: {
  task: ConductorDriverTask;
  compact?: boolean;
  className?: string;
}) {
  if (!task.boxDisplayLines.length) {
    return null;
  }

  return (
    <ShipmentBoxLinesTrigger
      lines={task.boxDisplayLines}
      variant={compact ? "inline" : "card"}
      className={className}
    />
  );
}

function ConductorTaskCard({
  task,
  isCompletedView,
  successDisabled,
  outcomeLabel,
  syncOperation,
  onOpenDialog,
  onReactivate,
  onRetrySync,
}: ConductorTaskItemProps) {
  return (
    <article className={`${listCardShellClass} flex flex-col overflow-hidden p-0`}>
      <div className="relative border-b border-black bg-surface-card-header px-3 py-2.5">
        <div className="absolute right-2 top-2">
          <ConductorTaskRecipientPeek task={task} className="relative" />
        </div>
        <p className="truncate text-center text-base font-black text-[#f8fafc]">{task.shipmentCode}</p>
        <div className="mt-1 text-center">
          <ConductorTaskSenderSummary task={task} layout="card" />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-3">
        {task.addressLine ? (
          <div className="grid gap-2">
            <p className="line-clamp-2 rounded-md border border-black bg-surface-inset px-2.5 py-1.5 text-sm font-bold leading-snug text-slate-300">
              <MapPin className="mr-1 inline h-3.5 w-3.5 shrink-0 text-slate-500" />
              {task.addressLine}
              {task.zoneLabel ? <span className="text-slate-500"> · {task.zoneLabel}</span> : null}
            </p>
            {buildMapsNavigationUrl({
              lat: task.lat,
              lng: task.lng,
              label: task.addressLine,
            }) ? (
              <div className="flex flex-wrap gap-2">
                <a
                  href={
                    buildMapsNavigationUrl({
                      lat: task.lat,
                      lng: task.lng,
                      label: task.addressLine,
                    })!.google
                  }
                  target="_blank"
                  rel="noreferrer"
                  className={`${secondaryButtonClass} h-9 px-3 text-xs`}
                >
                  Google Maps
                </a>
                <a
                  href={
                    buildMapsNavigationUrl({
                      lat: task.lat,
                      lng: task.lng,
                      label: task.addressLine,
                    })!.apple
                  }
                  className={`${secondaryButtonClass} h-9 px-3 text-xs`}
                >
                  Apple Maps
                </a>
              </div>
            ) : null}
          </div>
        ) : null}

        {task.scheduledAt ? (
          <p className="text-sm font-bold text-slate-300">{formatScheduleAtDisplay(task.scheduledAt)}</p>
        ) : null}

        {task.routeName ? (
          <p className="text-sm font-bold text-slate-400">
            Ruta {task.routeName}
            {task.stopOrder ? ` - parada ${task.stopOrder}` : ""}
            {task.stopOrder && formatEtaMinutes(estimateRouteStopEtaMinutes(task.stopOrder))
              ? ` · ETA ~${formatEtaMinutes(estimateRouteStopEtaMinutes(task.stopOrder))}`
              : ""}
            {task.routeDate ? ` - ${task.routeDate}` : ""}
            {task.vehicleLabel ? ` · ${task.vehicleLabel}` : ""}
          </p>
        ) : null}

        {task.balanceDue > 0 ? (
          <p className="flex items-center gap-2 rounded-lg border border-amber-900/70 bg-amber-950/25 px-3 py-2 text-sm font-black text-amber-100">
            <DollarSign className="h-4 w-4" />
            Pendiente {formatMoneyValue(task.balanceDue)}
          </p>
        ) : null}

        {task.senderPhone ? (
          <a className={`${secondaryButtonClass} h-10 text-xs`} href={`tel:${task.senderPhone}`}>
            <Phone className="h-4 w-4" />
            Llamar
          </a>
        ) : null}

        {isCompletedView ? (
          <>
            {syncOperation ? (
              <ConductorTaskSyncBadge operation={syncOperation} onRetry={onRetrySync} />
            ) : null}
            <p
              className={`rounded-md border px-3 py-2 text-center text-sm font-black ${conductorTaskStatusClass(task.status)}`}
            >
              {outcomeLabel}
            </p>
            <Link
              href={buildLogisticaShipmentDeepLink(task.shipmentCode)}
              className={`${secondaryButtonClass} h-9 text-xs`}
            >
              Ver en logistica
            </Link>
            {task.status === "cancelled" && !syncOperation ? (
              <button
                type="button"
                className={`${secondaryButtonClass} h-11 text-sm`}
                onClick={() => onReactivate(task)}
              >
                <RotateCcw className="h-4 w-4" />
                Volver al listado
              </button>
            ) : null}
          </>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              className={`${primaryButtonClass} h-11 text-sm disabled:cursor-not-allowed disabled:opacity-40`}
              disabled={successDisabled}
              onClick={() => onOpenDialog(task, "completed")}
            >
              <PackageCheck className="h-4 w-4" />
              Listo
            </button>
            <button
              type="button"
              className={`${secondaryButtonClass} h-11 text-sm disabled:cursor-not-allowed disabled:opacity-40`}
              onClick={() => onOpenDialog(task, "failed")}
            >
              <XCircle className="h-4 w-4" />
              No se pudo
            </button>
          </div>
        )}

        {task.boxSummary ? (
          <ConductorTaskBoxSummary task={task} className="mt-auto" />
        ) : null}
      </div>
    </article>
  );
}

function ConductorTaskRow({
  task,
  isCompletedView,
  successDisabled,
  outcomeLabel,
  syncOperation,
  onOpenDialog,
  onReactivate,
  onRetrySync,
}: ConductorTaskItemProps) {
  const mapsUrl = task.addressLine
    ? buildMapsNavigationUrl({ lat: task.lat, lng: task.lng, label: task.addressLine })
    : null;

  return (
    <article className={`${listRowBaseClass} grid gap-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3 sm:px-4 ${listRowHoverClass}`}>
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-black text-[#f8fafc]">{task.shipmentCode}</span>
              {task.balanceDue > 0 ? (
                <span className="text-[11px] font-black text-amber-200">
                  {formatMoneyValue(task.balanceDue)}
                </span>
              ) : null}
            </div>
            <div className="mt-0.5">
              <ConductorTaskSenderSummary task={task} layout="row" />
            </div>
          </div>
          <ConductorTaskRecipientPeek task={task} className="relative shrink-0" />
        </div>
        {task.addressLine ? (
          <p className="mt-1 line-clamp-1 text-sm font-bold text-slate-300">
            <MapPin className="mr-1 inline h-3 w-3 shrink-0 text-slate-500" />
            {task.addressLine}
            {task.zoneLabel ? <span className="text-slate-500"> · {task.zoneLabel}</span> : null}
          </p>
        ) : null}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-bold text-slate-500">
          {task.scheduledAt ? <span>{formatScheduleAtDisplay(task.scheduledAt)}</span> : null}
          {task.routeName ? (
            <span>
              Ruta {task.routeName}
              {task.stopOrder ? ` · parada ${task.stopOrder}` : ""}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
        {mapsUrl ? (
          <a
            href={mapsUrl.google}
            target="_blank"
            rel="noreferrer"
            className={`${secondaryButtonClass} h-9 px-3 text-xs`}
          >
            Maps
          </a>
        ) : null}
        {task.senderPhone ? (
          <a className={`${secondaryButtonClass} h-9 px-3 text-xs`} href={`tel:${task.senderPhone}`}>
            <Phone className="h-4 w-4" />
            Llamar
          </a>
        ) : null}
        {isCompletedView ? (
          <>
            {syncOperation ? (
              <ConductorTaskSyncBadge operation={syncOperation} onRetry={onRetrySync} />
            ) : null}
            <span
              className={`rounded-md border px-2 py-1 text-[11px] font-black ${conductorTaskStatusClass(task.status)}`}
            >
              {outcomeLabel}
            </span>
            <Link
              href={buildLogisticaShipmentDeepLink(task.shipmentCode)}
              className={`${secondaryButtonClass} h-9 px-3 text-xs`}
            >
              Logística
            </Link>
            {task.status === "cancelled" && !syncOperation ? (
              <button
                type="button"
                className={`${secondaryButtonClass} h-9 px-3 text-xs`}
                onClick={() => onReactivate(task)}
              >
                <RotateCcw className="h-4 w-4" />
                Reintentar
              </button>
            ) : null}
          </>
        ) : (
          <>
            <button
              type="button"
              className={`${primaryButtonClass} h-9 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40`}
              disabled={successDisabled}
              onClick={() => onOpenDialog(task, "completed")}
            >
              <PackageCheck className="h-4 w-4" />
              Listo
            </button>
            <button
              type="button"
              className={`${secondaryButtonClass} h-9 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40`}
              onClick={() => onOpenDialog(task, "failed")}
            >
              <XCircle className="h-4 w-4" />
              No se pudo
            </button>
          </>
        )}
      </div>

      {task.boxSummary ? (
        <div className="sm:col-span-2">
          <ConductorTaskBoxSummary task={task} compact />
        </div>
      ) : null}
    </article>
  );
}

export function ConductorTareasClient({
  canPreview = false,
  drivers = [],
  previewDriverId = null,
  effectiveDriverId = null,
  effectiveDriverLabel,
  organizationId,
  userId,
  initialTasks = [],
  initialCompletedTasks = [],
  initialTruckSummary = null,
}: ConductorTareasClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const notify = useNotify();
  const { layout: viewLayout } = usePageViewLayout("conductor.tasks");
  const previewOptions = buildConductorPreviewPickerOptions(drivers);
  const [listMode, setListMode] = useState<TaskListMode>("pending");
  const [operationScope, setOperationScope] = useState<"domicilios" | "agencias">("domicilios");
  const [doneTaskIds, setDoneTaskIds] = useState<string[]>([]);
  const [completedTasks, setCompletedTasks] = useState<ConductorDriverTask[]>(initialCompletedTasks);
  const [dialog, setDialog] = useState<TaskDialogState | null>(null);
  const [saving, setSaving] = useState(false);
  const [failureReason, setFailureReason] = useState<string>(CONDUCTOR_TASK_FAILURE_REASONS[0]);
  const [note, setNote] = useState("");
  const [evidence, setEvidence] = useState<File | null>(null);
  const [invoiceVisible, setInvoiceVisible] = useState(false);
  const [paymentChoice, setPaymentChoice] = useState<ConductorPaymentChoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [reactivateTask, setReactivateTask] = useState<ConductorDriverTask | null>(null);
  const [reactivating, setReactivating] = useState(false);
  const boxInvoicesLabel = dialog?.task.boxInvoiceCodes.join(", ") || dialog?.task.shipmentCode || "";
  const [online, setOnline] = useState(true);
  const [offlineSnapshot, setOfflineSnapshot] = useState(() => summarizeConductorOfflineOperations([]));
  const submittingRef = useRef(false);
  const refreshAfterSyncRef = useRef(false);

  const offlineScope = useMemo<ConductorOfflineScope | null>(() => {
    if (!organizationId || !userId || !effectiveDriverId) return null;
    return { organizationId, userId, driverId: effectiveDriverId };
  }, [effectiveDriverId, organizationId, userId]);
  const offlineOperationByTaskId = useMemo(
    () => new Map(offlineSnapshot.operations.map((operation) => [operation.taskId, operation])),
    [offlineSnapshot.operations],
  );


  const pendingTasks = useMemo(
    () => initialTasks.filter((task) => !doneTaskIds.includes(task.id) && !offlineOperationByTaskId.has(task.id)),
    [doneTaskIds, initialTasks, offlineOperationByTaskId],
  );
  const activeTasks = listMode === "pending" ? pendingTasks : completedTasks;
  const pendingSummary = useMemo(() => summarizeConductorTasks(pendingTasks), [pendingTasks]);
  const completedSummary = useMemo(() => summarizeConductorTasks(completedTasks), [completedTasks]);
  const [taskFilter, setTaskFilter] = useState<LogisticsTaskType>(() =>
    pendingSummary.deliverCount > 0 ? "deliver_empty_box" : "pickup_full_box",
  );
  const filteredTasks = useMemo(
    () => activeTasks.filter((task) => task.taskType === taskFilter),
    [activeTasks, taskFilter],
  );

  function handleListModeChange(next: TaskListMode) {
    if (next === listMode) {
      return;
    }

    setListMode(next);
  }

  function handleTaskFilterChange(nextFilter: LogisticsTaskType) {
    setTaskFilter(nextFilter);
  }
  const completedCount = completedSummary.deliverCount + completedSummary.pickupCount;
  const pendingCount = pendingSummary.deliverCount + pendingSummary.pickupCount;
  const selectedPendingTasks = useMemo(
    () => pendingTasks.filter((task) => task.taskType === taskFilter),
    [pendingTasks, taskFilter],
  );
  const selectedCompletedTasks = useMemo(
    () => completedTasks.filter((task) => task.taskType === taskFilter),
    [completedTasks, taskFilter],
  );
  const selectedPendingSummary = useMemo(
    () => summarizeConductorTasks(selectedPendingTasks),
    [selectedPendingTasks],
  );
  const completedOutcomeSummary = useMemo(
    () => summarizeConductorCompletedOutcomes(selectedCompletedTasks),
    [selectedCompletedTasks],
  );
  const selectedPendingBoxes =
    taskFilter === "deliver_empty_box"
      ? selectedPendingSummary.deliverCount
      : selectedPendingSummary.pickupCount;

  useEffect(() => {
    queueMicrotask(() => {
      const localTasks = offlineSnapshot.operations.map((operation) => ({
        ...operation.task,
        status: operation.result === "completed" ? "completed" as const : "cancelled" as const,
      }));
      const merged = [...localTasks, ...initialCompletedTasks];
      setCompletedTasks(merged.filter((task, index) => merged.findIndex((entry) => entry.id === task.id) === index));
    });
  }, [initialCompletedTasks, offlineSnapshot.operations]);

  const paymentExpectedAmount =
    dialog?.result === "completed" &&
    dialog.task.taskType === "deliver_empty_box" &&
    dialog.task.balanceDue > 0
      ? dialog.task.depositDue > 0
        ? dialog.task.depositDue
        : dialog.task.balanceDue
      : 0;
  const needsPaymentChoice = paymentExpectedAmount > 0;
  const dialogNeedsPhoto = Boolean(
    dialog && (dialog.result === "completed" || failureReason === "Invoice no visible"),
  );

  const reloadOfflineSnapshot = useCallback(async () => {
    if (!offlineScope) {
      setOfflineSnapshot(summarizeConductorOfflineOperations([]));
      return summarizeConductorOfflineOperations([]);
    }
    const snapshot = await readConductorOfflineSnapshot(offlineScope);
    setOfflineSnapshot(snapshot);
    return snapshot;
  }, [offlineScope]);

  const syncOfflineResults = useCallback(async () => {
    if (!offlineScope || !navigator.onLine) return;
    const before = await readConductorOfflineSnapshot(offlineScope);
    const after = await flushConductorTaskResults(offlineScope);
    setOfflineSnapshot(after);
    if (after.syncedCount > before.syncedCount && !refreshAfterSyncRef.current) {
      refreshAfterSyncRef.current = true;
      router.refresh();
      window.setTimeout(() => {
        refreshAfterSyncRef.current = false;
      }, 2_000);
    }
  }, [offlineScope, router]);

  useEffect(() => {
    queueMicrotask(() => {
      setDoneTaskIds([]);
      setOnline(navigator.onLine);
    });
    void requestPersistentConductorStorage();
    if (offlineScope && navigator.onLine) {
      void cacheConductorOfflineShell(offlineScope);
    }
    queueMicrotask(() => {
      void reloadOfflineSnapshot().then(() => syncOfflineResults());
    });

    const handleOnline = () => {
      setOnline(true);
      void syncOfflineResults();
    };
    const handleOffline = () => setOnline(false);
    const handleChanged = () => void reloadOfflineSnapshot();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void syncOfflineResults();
    };
    const handleWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === "BOXARIO_CONDUCTOR_QUEUE_CHANGED") handleChanged();
    };
    const channel = typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel(CONDUCTOR_OFFLINE_CHANGED_EVENT)
      : null;
    if (channel) channel.onmessage = handleChanged;

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener(CONDUCTOR_OFFLINE_CHANGED_EVENT, handleChanged);
    document.addEventListener("visibilitychange", handleVisibility);
    navigator.serviceWorker?.addEventListener("message", handleWorkerMessage);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void syncOfflineResults();
    }, 15_000);

    return () => {
      window.clearInterval(interval);
      channel?.close();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(CONDUCTOR_OFFLINE_CHANGED_EVENT, handleChanged);
      document.removeEventListener("visibilitychange", handleVisibility);
      navigator.serviceWorker?.removeEventListener("message", handleWorkerMessage);
    };
  }, [offlineScope, reloadOfflineSnapshot, syncOfflineResults]);

  useEffect(() => {
    if (!offlineScope) return;
    const completedIds = new Set(initialCompletedTasks.map((task) => task.id));
    void pruneSyncedConductorOperations(offlineScope, completedIds).then(reloadOfflineSnapshot);
  }, [initialCompletedTasks, offlineScope, reloadOfflineSnapshot]);

  const handlePreviewDriverChange = useCallback(
    (nextDriverId: string) => {
      const params = new URLSearchParams(searchParams.toString());

      if (nextDriverId) {
        params.set("conductor", nextDriverId);
      } else {
        params.delete("conductor");
      }

      const query = params.toString();
      router.replace(query ? `/conductor/tareas?${query}` : "/conductor/tareas", {
        scroll: false,
      });
    },
    [router, searchParams],
  );

  function openDialog(task: ConductorDriverTask, result: "completed" | "failed") {
    setDialog({ task, result });
    setFailureReason(CONDUCTOR_TASK_FAILURE_REASONS[0]);
    setNote("");
    setEvidence(null);
    setInvoiceVisible(false);
    setPaymentMethod("cash");
    setPaymentChoice(null);
    setPaymentAmount("");
  }

  function closeDialog() {
    if (saving) {
      return;
    }

    setDialog(null);
  }

  async function submitDialog() {
    if (!dialog || submittingRef.current) {
      return;
    }

    const needsPhoto = dialog.result === "completed" || failureReason === "Invoice no visible";

    if (needsPhoto && !evidence) {
      notify.error("Foto requerida");
      return;
    }

    if (dialog.result === "completed" && !invoiceVisible) {
      notify.error("Confirma que el invoice se ve escrito en la caja");
      return;
    }

    if (needsPaymentChoice && !paymentChoice) {
      notify.error("Indica si recibiste el depósito");
      return;
    }

    if (paymentChoice === "custom" && !paymentAmount.trim()) {
      notify.error("Indica el monto recibido");
      return;
    }

    if (!offlineScope) {
      notify.error("No se pudo preparar el almacenamiento local");
      return;
    }

    submittingRef.current = true;
    setSaving(true);

    try {
      await enqueueConductorTaskResult({
        scope: offlineScope,
        task: dialog.task,
        result: dialog.result,
        invoiceVisible,
        failureReason,
        note,
        paymentChoice,
        paymentAmount,
        paymentMethod,
        evidence,
      });

      setDoneTaskIds((current) =>
        current.includes(dialog.task.id) ? current : [...current, dialog.task.id],
      );
      setCompletedTasks((current) => {
        const nextTask: ConductorDriverTask = {
          ...dialog.task,
          status: dialog.result === "completed" ? "completed" : "cancelled",
        };

        return [nextTask, ...current.filter((task) => task.id !== nextTask.id)];
      });
      setDialog(null);
      notify.success("Guardada en este teléfono");
      await reloadOfflineSnapshot();
      void requestConductorBackgroundSync();
      void syncOfflineResults();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "No se pudo guardar en este teléfono");
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  }

  async function handleRetrySync(operationId: string) {
    await retryConductorOfflineOperation(operationId);
    await reloadOfflineSnapshot();
    void requestConductorBackgroundSync();
    void syncOfflineResults();
  }

  async function handleRetryAllSync() {
    const operations = offlineSnapshot.operations.filter(
      (operation) => operation.status === "needs_attention",
    );
    await Promise.all(operations.map((operation) => retryConductorOfflineOperation(operation.id)));
    await reloadOfflineSnapshot();
    void requestConductorBackgroundSync();
    void syncOfflineResults();
  }

  async function confirmReactivateTask() {
    if (!reactivateTask) {
      return;
    }

    setReactivating(true);

    try {
      const result = await reactivateConductorTaskAction({
        taskId: reactivateTask.id,
        driverId: effectiveDriverId,
      });

      if (!result.ok) {
        notify.error(result.error);
        return;
      }

      setCompletedTasks((current) => current.filter((task) => task.id !== reactivateTask.id));
      setDoneTaskIds((current) => current.filter((taskId) => taskId !== reactivateTask.id));
      if (offlineScope) {
        await removeConductorOperationsForTask(offlineScope, reactivateTask.id);
        await reloadOfflineSnapshot();
      }
      setReactivateTask(null);
      setTaskFilter(reactivateTask.taskType);
      setListMode("pending");
      notify.success("Tarea devuelta al listado");
      router.refresh();
    } finally {
      setReactivating(false);
    }
  }

  const emptyMessage =
    listMode === "completed"
      ? taskFilter === "deliver_empty_box"
        ? "Sin entregas completadas"
        : "Sin recogidas completadas"
      : canPreview
        ? effectiveDriverId
          ? taskFilter === "deliver_empty_box"
            ? "Sin cajas por dejar"
            : "Sin cajas por recoger"
          : "No hay conductores activos"
        : taskFilter === "deliver_empty_box"
          ? "Sin cajas por dejar"
          : "Sin cajas por recoger";

  const emptyDetail =
    listMode === "completed"
      ? "Aquí verás las cajas que marcaste como listas o que no se pudieron entregar."
      : canPreview
        ? effectiveDriverId
          ? `Vista de ${effectiveDriverLabel}. Puedes completar tareas en su nombre; queda registrado como admin.`
          : "Crea o activa conductores en Logística para previsualizar su vista."
        : taskFilter === "deliver_empty_box"
          ? "Aquí verás entregas de cajas vacías y paradas de tu ruta del día."
          : "Aquí verás recogidas de cajas llenas y paradas de tu ruta del día.";

  const shortageTotal = initialTruckSummary?.shortageTotal ?? 0;
  const routeBlocked = !canPreview && listMode === "pending" && shortageTotal > 0;
  const offlineGlobalLabel = conductorOfflineGlobalLabel(offlineSnapshot, online);
  const hasSyncActivity = offlineSnapshot.pendingCount + offlineSnapshot.syncingCount > 0;

  return (
    <>
    <Panel
      title={canPreview ? "Tareas conductor" : "Mis tareas"}
      hideHeader
      className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden"
      contentClassName="flex flex-col p-4 sm:p-5 lg:min-h-0 lg:flex-1"
    >
        <section className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-black bg-surface-card-header p-2 shadow-[0_6px_18px_rgba(0,0,0,0.12)]">
          {canPreview ? (
            <div className="flex h-10 min-w-0 items-center gap-2 rounded-md border border-sky-800/70 bg-sky-950/25 pl-2">
              <p className="shrink-0 text-xs font-black uppercase tracking-wide text-sky-300">Admin</p>
              <CompactInfoDisclosure ariaLabel="Ver detalle de vista administrativa" tone="sky">
                Vista del conductor. Puedes completar tareas en su nombre; queda registrado como admin.
              </CompactInfoDisclosure>
              <InlineSearchPicker
                value={previewDriverId || ""}
                onChange={handlePreviewDriverChange}
                options={previewOptions}
                placeholder="Conductor"
                searchPlaceholder="Buscar conductor"
                emptyLabel="Sin conductores"
                ariaLabel="Conductor a previsualizar"
                minWidthClass="min-w-[11rem] sm:min-w-[14rem]"
                disabled={!previewOptions.length}
              />
            </div>
          ) : (
            <div className="flex h-10 min-w-0 items-center gap-2 px-1.5">
              <p className="shrink-0 text-xs font-black uppercase tracking-wide text-slate-500">Ruta</p>
              <h1 className="max-w-48 truncate text-sm font-black tracking-tight text-[#f8fafc]">{effectiveDriverLabel}</h1>
            </div>
          )}

          <div className="flex h-10 min-w-0 overflow-hidden rounded-md border border-black">
            <div className="flex min-w-0 items-center gap-1.5 bg-surface-card px-2">
              <p className="text-xs font-black text-slate-400">Faltan</p>
              <p className="text-base font-black tabular-nums text-[#f8fafc]">{selectedPendingBoxes}</p>
            </div>
            <div className="flex min-w-0 items-center gap-1.5 border-l border-black bg-emerald-950/25 px-2">
              <p className="text-xs font-black text-emerald-300">Listas</p>
              <p className="text-base font-black tabular-nums text-emerald-200">{completedOutcomeSummary.successBoxes}</p>
            </div>
            <div className="flex min-w-0 items-center gap-1.5 border-l border-black bg-rose-950/25 px-2">
              <p className="text-xs font-black text-rose-300">No se pudo</p>
              <p className="text-base font-black tabular-nums text-rose-200">{completedOutcomeSummary.failedBoxes}</p>
            </div>
          </div>

          <div className="flex h-10 min-w-0 overflow-hidden rounded-md border border-black" role="group" aria-label="Cambiar origen de tareas">
            <button type="button" className={`flex-1 text-xs font-black ${operationScope === "domicilios" ? "bg-emerald-950/35 text-emerald-100" : "bg-surface-card text-slate-300"}`} onClick={() => setOperationScope("domicilios")}>Domicilios</button>
            <button type="button" className={`flex-1 border-l border-black text-xs font-black ${operationScope === "agencias" ? "bg-emerald-950/35 text-emerald-100" : "bg-surface-card text-slate-300"}`} onClick={() => setOperationScope("agencias")}>Agencias</button>
          </div>

          {operationScope === "domicilios" ? <><div className="flex h-10 min-w-0 overflow-hidden rounded-md border border-black" role="group" aria-label="Filtrar tareas por tipo">
            <button
              type="button"
              aria-pressed={taskFilter === "deliver_empty_box"}
              className={`flex min-w-0 items-center gap-1.5 px-2.5 text-left text-xs font-black transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 ${
                taskFilter === "deliver_empty_box"
                  ? "bg-emerald-950/35 text-emerald-100"
                  : "bg-surface-card text-slate-300 hover:bg-surface-inset"
              }`}
              onClick={() => handleTaskFilterChange("deliver_empty_box")}
            >
              <span className="truncate text-xs font-black text-emerald-200">Por dejar</span>
              <span className="shrink-0 tabular-nums text-emerald-200">{pendingSummary.deliverCount}</span>
              <span className="sr-only">cajas por hacer</span>
            </button>
            <button
              type="button"
              aria-pressed={taskFilter === "pickup_full_box"}
              className={`flex min-w-0 items-center gap-1.5 border-l border-black px-2.5 text-left text-xs font-black transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${
                taskFilter === "pickup_full_box"
                  ? "bg-amber-950/30 text-amber-100"
                  : "bg-surface-card text-slate-300 hover:bg-surface-inset"
              }`}
              onClick={() => handleTaskFilterChange("pickup_full_box")}
            >
              <span className="truncate text-xs font-black text-amber-200">Por recoger</span>
              <span className="shrink-0 tabular-nums text-amber-200">{pendingSummary.pickupCount}</span>
              <span className="sr-only">cajas por hacer</span>
            </button>
          </div>

          <div className="flex h-10 min-w-0 overflow-hidden rounded-md border border-black bg-surface-inset" role="tablist" aria-label="Vista de tareas">
              <button
                type="button"
                role="tab"
                aria-selected={listMode === "pending"}
                className={`flex min-w-0 items-center justify-center gap-1.5 px-3 text-sm font-black transition ${
                  listMode === "pending"
                    ? "bg-emerald-950/50 text-emerald-100"
                    : "bg-surface-card text-slate-300 hover:bg-surface-inset"
                }`}
                onClick={() => handleListModeChange("pending")}
              >
                <ListTodo className="h-4 w-4 shrink-0" />
                En ruta
                <span className="rounded-full border border-black bg-surface-inset px-1.5 py-0.5 text-xs font-black tabular-nums text-slate-300">{pendingCount}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={listMode === "completed"}
                className={`flex min-w-0 items-center justify-center gap-1.5 border-l border-black px-3 text-sm font-black transition ${
                  listMode === "completed"
                    ? "bg-sky-950/50 text-sky-100"
                    : "bg-surface-card text-slate-300 hover:bg-surface-inset"
                }`}
                onClick={() => handleListModeChange("completed")}
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Resueltas
                <span className="rounded-full border border-black bg-surface-inset px-1.5 py-0.5 text-xs font-black tabular-nums text-slate-300">{completedCount}</span>
              </button>
          </div>

          <button
            type="button"
            className={`flex h-10 min-w-0 items-center gap-1.5 rounded-md border border-black px-2.5 text-xs font-black ${
              offlineSnapshot.needsAttentionCount > 0
                ? "bg-rose-950/35 text-rose-200"
                : hasSyncActivity
                  ? "bg-amber-950/30 text-amber-200"
                  : "bg-emerald-950/25 text-emerald-200"
            }`}
            aria-live="polite"
            disabled={offlineSnapshot.needsAttentionCount === 0}
            title={offlineSnapshot.needsAttentionCount > 0 ? "Reintentar sincronización" : undefined}
            onClick={() => void handleRetryAllSync()}
          >
            {!online ? (
              <WifiOff className="h-4 w-4 shrink-0" />
            ) : hasSyncActivity ? (
              <RefreshCw className={`h-4 w-4 shrink-0 ${offlineSnapshot.syncingCount > 0 ? "animate-spin" : ""}`} />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            )}
            <span className="truncate">{offlineGlobalLabel}</span>
          </button>
          </> : null}
        </section>

        {routeBlocked ? (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-rose-800/70 bg-rose-950/35 px-3 py-2">
            <AlertTriangle className="h-5 w-5 shrink-0 text-rose-300" />
            <p className="min-w-0 flex-1 text-sm font-black text-rose-100">
              Faltan {shortageTotal} {shortageTotal === 1 ? "caja vacía" : "cajas vacías"} en el camión.
            </p>
            <Link
              href="/conductor/inventario-camion"
              className={`${secondaryButtonClass} h-9 border-rose-800/70 px-3 text-xs text-rose-100 hover:bg-rose-900/40`}
            >
              Cargar cajas
            </Link>
          </div>
        ) : null}

        {operationScope === "agencias" && effectiveDriverId ? <AgencyVisitsPanel driverId={effectiveDriverId} /> : filteredTasks.length ? (
          <div className="pr-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            {viewLayout === "rows" ? (
              <div className={`${cardClass} overflow-hidden p-2`}>
                <div className="flex flex-col gap-2">
                  {filteredTasks.map((task) => {
                    const isCompletedView = listMode === "completed";
                    const successDisabled =
                      !isCompletedView &&
                      task.taskType === "deliver_empty_box" &&
                      routeBlocked &&
                      task.status !== "loaded_to_truck";

                    return (
                      <ConductorTaskRow
                        key={task.id}
                        task={task}
                        isCompletedView={isCompletedView}
                        successDisabled={successDisabled}
                        outcomeLabel={conductorTaskOutcomeLabel(task.status)}
                        syncOperation={offlineOperationByTaskId.get(task.id)}
                        onOpenDialog={openDialog}
                        onReactivate={setReactivateTask}
                        onRetrySync={(operationId) => void handleRetrySync(operationId)}
                      />
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="grid items-start gap-2.5 lg:grid-cols-2 xl:grid-cols-3">
                {filteredTasks.map((task) => {
                  const isCompletedView = listMode === "completed";
                  const successDisabled =
                    !isCompletedView &&
                    task.taskType === "deliver_empty_box" &&
                    routeBlocked &&
                    task.status !== "loaded_to_truck";

                  return (
                    <ConductorTaskCard
                      key={task.id}
                      task={task}
                      isCompletedView={isCompletedView}
                      successDisabled={successDisabled}
                      outcomeLabel={conductorTaskOutcomeLabel(task.status)}
                      syncOperation={offlineOperationByTaskId.get(task.id)}
                      onOpenDialog={openDialog}
                      onReactivate={setReactivateTask}
                      onRetrySync={(operationId) => void handleRetrySync(operationId)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="flex min-h-[8rem] items-center justify-center rounded-lg border border-dashed border-black/70 bg-surface-card/40 px-4 py-6 text-center">
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-black bg-surface-inset text-slate-300">
                <ListTodo className="h-5 w-5" />
              </span>
              <p className="text-lg font-black text-[#f8fafc]">{emptyMessage}</p>
              <CompactInfoDisclosure ariaLabel="Ver más información">
                {emptyDetail}
              </CompactInfoDisclosure>
            </div>
          </div>
        )}
      </Panel>

      {dialog ? (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/70 p-3 sm:p-4">
          <button
            type="button"
            aria-label="Cerrar"
            className="absolute inset-0"
            disabled={saving}
            onClick={closeDialog}
          />
          <div className="relative flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-black bg-surface-panel shadow-2xl">
            <div className="flex items-start gap-3 border-b border-black bg-surface-card-header px-4 py-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-black ${dialog.result === "completed" ? "bg-emerald-400" : "bg-rose-400"} text-slate-950`}>
                {dialog.result === "completed" ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-black text-[#f8fafc]">
                  {dialog.result === "completed" ? "Confirmar tarea" : "Cancelar visita"}
                </p>
                <p className="truncate text-xs font-black text-slate-400">
                  {dialog.task.shipmentCode} - {dialog.task.senderName}
                </p>
              </div>
              <button
                type="button"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black bg-surface-inset text-slate-300"
                disabled={saving}
                onClick={closeDialog}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3 overflow-y-auto p-4">
              {dialog.result === "failed" ? (
                <label className="grid gap-1.5 text-xs font-black text-slate-400">
                  Razón
                  <select
                    className={`${inputClass} text-sm`}
                    value={failureReason}
                    disabled={saving}
                    onChange={(event) => setFailureReason(event.target.value)}
                  >
                    {CONDUCTOR_TASK_FAILURE_REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {dialog.result === "completed" ? (
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-3 text-sm font-black text-emerald-50">
                  <input
                    className="mt-0.5 h-5 w-5 accent-emerald-400"
                    type="checkbox"
                    checked={invoiceVisible}
                    disabled={saving}
                    onChange={(event) => setInvoiceVisible(event.target.checked)}
                  />
                  <span>
                    Confirmo que la factura de cada caja <span className="font-mono text-emerald-300">{boxInvoicesLabel}</span> esta escrita con marcador y se ve clara en la caja.
                  </span>
                </label>
              ) : null}

              <label className="grid gap-1.5 text-xs font-black text-slate-400">
                Foto {dialogNeedsPhoto ? "obligatoria" : "opcional"}
                {dialog.result === "completed" ? (
                  <span className="normal-case text-slate-300">La foto debe mostrar el invoice escrito en la caja.</span>
                ) : failureReason === "Invoice no visible" ? (
                  <span className="normal-case text-rose-300">Toma una foto para dejar evidencia de que falta el invoice.</span>
                ) : null}
                <span className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-black bg-surface-inset px-3 py-4 text-center text-sm font-black text-slate-300">
                  <Camera className="mb-2 h-6 w-6 text-slate-500" />
                  {evidence ? evidence.name : "Tomar o subir foto"}
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    disabled={saving}
                    onChange={(event) => setEvidence(event.target.files?.[0] || null)}
                  />
                </span>
              </label>

              {needsPaymentChoice ? (
                <div className="grid gap-3 rounded-lg border border-black bg-surface-card p-3">
                  <p className="text-xs font-black uppercase text-slate-500">Cobro de depósito</p>
                  <p className="text-sm font-black text-slate-200">
                    Esperado: {formatMoneyValue(paymentExpectedAmount)}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      disabled={saving}
                      className={`${paymentChoice === "expected" ? primaryButtonClass : secondaryButtonClass} min-h-12 text-sm`}
                      onClick={() => setPaymentChoice("expected")}
                    >
                      Recibí {formatMoneyValue(paymentExpectedAmount)}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      className={`${paymentChoice === "custom" ? primaryButtonClass : secondaryButtonClass} min-h-12 text-sm`}
                      onClick={() => setPaymentChoice("custom")}
                    >
                      Recibí otro monto
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      className={`${paymentChoice === "none" ? primaryButtonClass : secondaryButtonClass} min-h-12 text-sm`}
                      onClick={() => setPaymentChoice("none")}
                    >
                      No recibí dinero
                    </button>
                  </div>
                  {paymentChoice === "custom" ? (
                    <label className="grid gap-1.5 text-xs font-black text-slate-400">
                      Monto recibido
                      <input
                        className={inputClass}
                        value={paymentAmount}
                        disabled={saving}
                        inputMode="decimal"
                        placeholder={formatMoneyValue(paymentExpectedAmount)}
                        onChange={(event) => setPaymentAmount(event.target.value)}
                      />
                    </label>
                  ) : null}
                  {paymentChoice && paymentChoice !== "none" ? (
                    <label className="grid gap-1.5 text-xs font-black text-slate-400">
                      Método
                      <select
                        className={inputClass}
                        value={paymentMethod}
                        disabled={saving}
                        onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                      >
                        {PAYMENT_METHOD_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>
              ) : null}

              <label className="grid gap-1.5 text-xs font-black text-slate-400">
                Nota
                <textarea
                  className="min-h-24 rounded-lg border border-black bg-surface-inset px-3 py-2 text-sm font-bold leading-snug text-[#f8fafc] outline-none placeholder:text-slate-500 disabled:opacity-50"
                  value={note}
                  maxLength={1000}
                  disabled={saving}
                  placeholder={dialog.result === "completed" ? "Ej. Dejadas en puerta principal." : "Ej. Llame 2 veces, no contestaron."}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  className={`${secondaryButtonClass} h-11 text-sm`}
                  disabled={saving}
                  onClick={closeDialog}
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  className={`${primaryButtonClass} h-11 text-sm disabled:cursor-not-allowed disabled:opacity-40`}
                  disabled={saving || (dialogNeedsPhoto && !evidence) || (dialog.result === "completed" && !invoiceVisible) || (needsPaymentChoice && !paymentChoice)}
                  onClick={() => void submitDialog()}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ActionConfirmDialog
        open={Boolean(reactivateTask)}
        title="Volver al listado"
        message={
          reactivateTask
            ? `¿Devolver ${reactivateTask.shipmentCode} al listado de pendientes? Podrás intentar la visita de nuevo.`
            : ""
        }
        confirmLabel="Volver al listado"
        tone="warning"
        confirming={reactivating}
        overlayClassName="z-[170]"
        onCancel={() => {
          if (!reactivating) {
            setReactivateTask(null);
          }
        }}
        onConfirm={() => void confirmReactivateTask()}
      />
    </>
  );
}
