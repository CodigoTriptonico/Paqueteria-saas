"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  X,
  XCircle,
} from "lucide-react";
import { ShipmentBoxLinesTrigger } from "@/components/shipment-box-lines-trigger";
import {
  submitConductorTaskResultAction,
  reactivateConductorTaskAction,
} from "@/app/actions/conductor-tasks";
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
  textMutedClass,
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
import { estimateRouteStopEtaMinutes, formatEtaMinutes } from "@/lib/logistics-eta";
import { buildLogisticaShipmentDeepLink } from "@/lib/logistics-view";
import { formatScheduleAtDisplay } from "@/lib/sale/schedule-time";

type ConductorTareasClientProps = {
  canPreview?: boolean;
  drivers?: ConductorDriverOption[];
  previewDriverId?: string | null;
  effectiveDriverId?: string | null;
  effectiveDriverLabel: string;
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
  onOpenDialog: (task: ConductorDriverTask, result: "completed" | "failed") => void;
  onReactivate: (task: ConductorDriverTask) => void;
};

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
    <details className={`group ${className}`}>
      <summary className="cursor-pointer list-none rounded-md border border-slate-700/80 bg-slate-900/60 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-400 transition hover:border-slate-600 hover:text-slate-200 [&::-webkit-details-marker]:hidden">
        Destinatario
      </summary>
      <div className="absolute right-0 z-10 mt-1 min-w-[10rem] max-w-[14rem] rounded-md border border-black bg-surface-panel px-2.5 py-1.5 text-left text-[11px] font-bold leading-snug text-slate-300 shadow-lg">
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
      </div>
    </details>
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
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Remitente</p>
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
      <span className="text-[10px] font-black uppercase text-slate-500">Remitente</span>
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
  onOpenDialog,
  onReactivate,
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
            <p className="line-clamp-2 rounded-md border border-black bg-surface-inset px-2 py-1 text-xs font-bold leading-snug text-slate-300">
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
                  className={`${secondaryButtonClass} h-8 px-2.5 text-[11px]`}
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
                  className={`${secondaryButtonClass} h-8 px-2.5 text-[11px]`}
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
            {task.status === "cancelled" ? (
              <button
                type="button"
                className={`${secondaryButtonClass} h-11 text-xs`}
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
              className={`${primaryButtonClass} h-11 text-xs disabled:cursor-not-allowed disabled:opacity-40`}
              disabled={successDisabled}
              onClick={() => onOpenDialog(task, "completed")}
            >
              <PackageCheck className="h-4 w-4" />
              Listo
            </button>
            <button
              type="button"
              className={`${secondaryButtonClass} h-11 text-xs disabled:cursor-not-allowed disabled:opacity-40`}
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
  onOpenDialog,
  onReactivate,
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
          <p className="mt-0.5 line-clamp-1 text-xs font-bold text-slate-400">
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
            className={`${secondaryButtonClass} h-8 px-2 text-[10px]`}
          >
            Maps
          </a>
        ) : null}
        {task.senderPhone ? (
          <a className={`${secondaryButtonClass} h-8 px-2 text-[10px]`} href={`tel:${task.senderPhone}`}>
            <Phone className="h-3.5 w-3.5" />
          </a>
        ) : null}
        {isCompletedView ? (
          <>
            <span
              className={`rounded-md border px-2 py-1 text-[11px] font-black ${conductorTaskStatusClass(task.status)}`}
            >
              {outcomeLabel}
            </span>
            <Link
              href={buildLogisticaShipmentDeepLink(task.shipmentCode)}
              className={`${secondaryButtonClass} h-8 px-2 text-[10px]`}
            >
              Logistica
            </Link>
            {task.status === "cancelled" ? (
              <button
                type="button"
                className={`${secondaryButtonClass} h-8 px-2 text-[10px]`}
                onClick={() => onReactivate(task)}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </>
        ) : (
          <>
            <button
              type="button"
              className={`${primaryButtonClass} h-8 px-2.5 text-[10px] disabled:cursor-not-allowed disabled:opacity-40`}
              disabled={successDisabled}
              onClick={() => onOpenDialog(task, "completed")}
            >
              <PackageCheck className="h-3.5 w-3.5" />
              Listo
            </button>
            <button
              type="button"
              className={`${secondaryButtonClass} h-8 px-2.5 text-[10px] disabled:cursor-not-allowed disabled:opacity-40`}
              onClick={() => onOpenDialog(task, "failed")}
            >
              <XCircle className="h-3.5 w-3.5" />
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
  const [doneTaskIds, setDoneTaskIds] = useState<string[]>([]);
  const [completedTasks, setCompletedTasks] = useState<ConductorDriverTask[]>(initialCompletedTasks);
  const [dialog, setDialog] = useState<TaskDialogState | null>(null);
  const [saving, setSaving] = useState(false);
  const [failureReason, setFailureReason] = useState<string>(CONDUCTOR_TASK_FAILURE_REASONS[0]);
  const [note, setNote] = useState("");
  const [evidence, setEvidence] = useState<File | null>(null);
  const [paymentChoice, setPaymentChoice] = useState<ConductorPaymentChoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [reactivateTask, setReactivateTask] = useState<ConductorDriverTask | null>(null);
  const [reactivating, setReactivating] = useState(false);


  const pendingTasks = useMemo(
    () => initialTasks.filter((task) => !doneTaskIds.includes(task.id)),
    [doneTaskIds, initialTasks],
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
      setCompletedTasks(initialCompletedTasks);
    });
  }, [initialCompletedTasks]);

  const paymentExpectedAmount =
    dialog?.result === "completed" &&
    dialog.task.taskType === "deliver_empty_box" &&
    dialog.task.balanceDue > 0
      ? dialog.task.depositDue > 0
        ? dialog.task.depositDue
        : dialog.task.balanceDue
      : 0;
  const needsPaymentChoice = paymentExpectedAmount > 0;

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };

    const interval = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);

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
    if (!dialog) {
      return;
    }

    const needsPhoto = dialog.result === "completed";

    if (needsPhoto && !evidence) {
      notify.error("Foto requerida");
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

    setSaving(true);

    try {
      const formData = new FormData();
      formData.set("taskId", dialog.task.id);
      formData.set("result", dialog.result);
      formData.set("failureReason", failureReason);
      formData.set("note", note);
      formData.set("paymentChoice", paymentChoice || "");
      formData.set("paymentAmount", paymentAmount);
      formData.set("paymentMethod", paymentMethod);

      if (effectiveDriverId) {
        formData.set("driverId", effectiveDriverId);
      }

      if (evidence) {
        formData.set("evidence", evidence);
      }

      const result = await submitConductorTaskResultAction(formData);

      if (!result.ok) {
        notify.error(result.error);
        return;
      }

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
      notify.success(dialog.result === "completed" ? "Tarea completada" : "Visita cancelada");

      router.refresh();
    } finally {
      setSaving(false);
    }
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
      ? "Aqui veras las cajas que ya marcaste como listas o no se pudieron."
      : canPreview
        ? effectiveDriverId
          ? `Vista de ${effectiveDriverLabel}. Puedes completar tareas en su nombre; queda registrado como admin.`
          : "Crea o activa conductores en Logistica para previsualizar su vista."
        : taskFilter === "deliver_empty_box"
          ? "Aqui veras entregas de cajas vacias y paradas de tu ruta del dia."
          : "Aqui veras recogidas de cajas llenas y paradas de tu ruta del dia.";

  const shortageTotal = initialTruckSummary?.shortageTotal ?? 0;
  const routeBlocked = !canPreview && listMode === "pending" && shortageTotal > 0;

  return (
    <>
    <Panel
      title={canPreview ? "Tareas conductor" : "Mis tareas"}
      hideHeader
      className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden"
      contentClassName="flex flex-col p-4 sm:p-5 lg:min-h-0 lg:flex-1"
    >
        {canPreview ? (
          <div className="mb-2 flex min-h-10 flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-sky-700/50 bg-sky-950/30 px-3 py-1.5">
            <p className="shrink-0 text-[10px] font-black uppercase tracking-[0.12em] text-sky-300">Vista admin</p>
            <details className="group relative shrink-0">
              <summary
                aria-label="Ver detalle de vista administrativa"
                className="flex h-5 w-5 cursor-pointer list-none items-center justify-center rounded-full border border-sky-500/60 text-[11px] font-black text-sky-200 transition hover:border-sky-300 hover:bg-sky-900/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 [&::-webkit-details-marker]:hidden"
              >
                !
              </summary>
              <p className="absolute left-0 top-full z-20 mt-2 w-72 rounded-md border border-black bg-surface-panel px-3 py-2 text-xs font-bold leading-snug text-slate-200 shadow-lg">
                Vista del conductor. Puedes completar tareas en su nombre; queda registrado como admin.
              </p>
            </details>
            <InlineSearchPicker
              value={previewDriverId || ""}
              onChange={handlePreviewDriverChange}
              options={previewOptions}
              placeholder="Elegir conductor"
              searchPlaceholder="Buscar conductor"
              emptyLabel="Sin conductores"
              ariaLabel="Conductor a previsualizar"
              minWidthClass="min-w-[11rem] sm:min-w-[14rem]"
              disabled={!previewOptions.length}
            />
          </div>
        ) : null}

        <section className="mb-3 flex flex-wrap items-center gap-1.5 rounded-lg border border-black bg-surface-card-header p-1.5 shadow-[0_6px_18px_rgba(0,0,0,0.12)]">
          <div className="flex h-9 min-w-0 items-baseline gap-1.5 px-1.5">
            <p className="shrink-0 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Ruta</p>
            <h1 className="max-w-48 truncate text-sm font-black tracking-tight text-[#f8fafc]">{effectiveDriverLabel}</h1>
          </div>

          <div className="flex h-9 min-w-0 overflow-hidden rounded-md border border-black">
            <div className="flex min-w-0 items-center gap-1.5 bg-surface-card px-2">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Faltan</p>
              <p className="text-base font-black tabular-nums text-[#f8fafc]">{selectedPendingBoxes}</p>
            </div>
            <div className="flex min-w-0 items-center gap-1.5 border-l border-black bg-emerald-950/25 px-2">
              <p className="text-[10px] font-black uppercase tracking-wide text-emerald-300/80">Listas</p>
              <p className="text-base font-black tabular-nums text-emerald-200">{completedOutcomeSummary.successBoxes}</p>
            </div>
            <div className="flex min-w-0 items-center gap-1.5 border-l border-black bg-rose-950/25 px-2">
              <p className="text-[10px] font-black uppercase tracking-wide text-rose-300/80">No se pudo</p>
              <p className="text-base font-black tabular-nums text-rose-200">{completedOutcomeSummary.failedBoxes}</p>
            </div>
          </div>

          <div className="flex h-9 min-w-0 overflow-hidden rounded-md border border-black" role="group" aria-label="Filtrar tareas por tipo">
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
              <span className="truncate text-[10px] font-black uppercase tracking-wide text-emerald-300/80">Por dejar</span>
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
              <span className="truncate text-[10px] font-black uppercase tracking-wide text-amber-300/80">Por recoger</span>
              <span className="shrink-0 tabular-nums text-amber-200">{pendingSummary.pickupCount}</span>
              <span className="sr-only">cajas por hacer</span>
            </button>
          </div>

          <div className="flex h-9 min-w-0 overflow-hidden rounded-md border border-black bg-surface-inset" role="tablist" aria-label="Vista de tareas">
              <button
                type="button"
                role="tab"
                aria-selected={listMode === "pending"}
                className={`flex min-w-0 items-center justify-center gap-1.5 px-2.5 text-xs font-black transition ${
                  listMode === "pending"
                    ? "bg-emerald-950/50 text-emerald-100"
                    : "bg-surface-card text-slate-300 hover:bg-surface-inset"
                }`}
                onClick={() => handleListModeChange("pending")}
              >
                <ListTodo className="h-4 w-4 shrink-0" />
                En ruta
                <span className="rounded-full border border-black bg-surface-inset px-1.5 py-0.5 text-[10px] font-black tabular-nums text-slate-300">{pendingCount}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={listMode === "completed"}
                className={`flex min-w-0 items-center justify-center gap-1.5 border-l border-black px-2.5 text-xs font-black transition ${
                  listMode === "completed"
                    ? "bg-sky-950/50 text-sky-100"
                    : "bg-surface-card text-slate-300 hover:bg-surface-inset"
                }`}
                onClick={() => handleListModeChange("completed")}
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Resueltas
                <span className="rounded-full border border-black bg-surface-inset px-1.5 py-0.5 text-[10px] font-black tabular-nums text-slate-300">{completedCount}</span>
              </button>
          </div>
        </section>

        {routeBlocked ? (
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-rose-800/70 bg-rose-950/35 px-4 py-3 sm:flex-row sm:items-center">
            <AlertTriangle className="h-5 w-5 shrink-0 text-rose-300" />
            <p className="min-w-0 flex-1 text-sm font-black text-rose-100">
              Tienes {shortageTotal} {shortageTotal === 1 ? "caja vacía" : "cajas vacías"} por subir al camión. Primero, {" "}
              <Link
                href="/conductor/inventario-camion"
                className="text-rose-100 underline decoration-rose-300/80 underline-offset-4 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-200"
              >
                ver inventario
              </Link>{" "}
              y súbelas al camión.
            </p>
          </div>
        ) : null}

        {filteredTasks.length ? (
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
                        onOpenDialog={openDialog}
                        onReactivate={setReactivateTask}
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
                      onOpenDialog={openDialog}
                      onReactivate={setReactivateTask}
                    />
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="flex min-h-[14rem] flex-col items-center justify-center rounded-xl border border-dashed border-black/70 bg-surface-card/40 px-6 py-10 text-center">
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-black bg-surface-inset text-slate-300">
              <ListTodo className="h-7 w-7" />
            </span>
            <p className="text-xl font-black text-[#f8fafc]">{emptyMessage}</p>
            <p className={`mt-2 max-w-md ${textMutedClass}`}>{emptyDetail}</p>
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
                <label className="grid gap-1 text-[10px] font-black uppercase text-slate-500">
                  Razon
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

              <label className="grid gap-1 text-[10px] font-black uppercase text-slate-500">
                Foto {dialog.result === "completed" ? "obligatoria" : "opcional"}
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
                      className={`${paymentChoice === "expected" ? primaryButtonClass : secondaryButtonClass} min-h-12 text-xs`}
                      onClick={() => setPaymentChoice("expected")}
                    >
                      Recibí {formatMoneyValue(paymentExpectedAmount)}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      className={`${paymentChoice === "custom" ? primaryButtonClass : secondaryButtonClass} min-h-12 text-xs`}
                      onClick={() => setPaymentChoice("custom")}
                    >
                      Recibí otro monto
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      className={`${paymentChoice === "none" ? primaryButtonClass : secondaryButtonClass} min-h-12 text-xs`}
                      onClick={() => setPaymentChoice("none")}
                    >
                      No recibí dinero
                    </button>
                  </div>
                  {paymentChoice === "custom" ? (
                    <label className="grid gap-1 text-[10px] font-black uppercase text-slate-500">
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
                    <label className="grid gap-1 text-[10px] font-black uppercase text-slate-500">
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

              <label className="grid gap-1 text-[10px] font-black uppercase text-slate-500">
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
                  className={`${secondaryButtonClass} h-11 text-xs`}
                  disabled={saving}
                  onClick={closeDialog}
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  className={`${primaryButtonClass} h-11 text-xs disabled:cursor-not-allowed disabled:opacity-40`}
                  disabled={saving || (dialog.result === "completed" && !evidence) || (needsPaymentChoice && !paymentChoice)}
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
