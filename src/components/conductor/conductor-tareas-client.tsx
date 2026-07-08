"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  DollarSign,
  History,
  ListTodo,
  Loader2,
  MapPin,
  Boxes,
  PackageCheck,
  Phone,
  Truck,
  X,
  XCircle,
} from "lucide-react";
import type { ActivityHistoryRow } from "@/app/actions/history";
import {
  listConductorTaskActivityHistoryAction,
  submitConductorTaskResultAction,
} from "@/app/actions/conductor-tasks";
import { AuditHistoryEntry } from "@/components/audit-history-entry";
import { InlineSearchPicker } from "@/components/inline-search-picker";
import {
  cardClass,
  inputClass,
  Panel,
  primaryButtonClass,
  secondaryButtonClass,
  textMutedClass,
} from "@/components/ui-blocks";
import { useNotify } from "@/hooks/use-notify";
import { formatMoneyValue } from "@/lib/logistics-fees";
import { PAYMENT_METHOD_OPTIONS, type PaymentMethod } from "@/lib/payment-methods";
import {
  buildConductorPreviewPickerOptions,
  type ConductorDriverOption,
} from "@/lib/conductor-tareas-view";
import {
  conductorTaskStatusClass,
  conductorTaskTypeLabel,
  type ConductorDriverTask,
} from "@/lib/conductor-tasks";
import {
  CONDUCTOR_TASK_FAILURE_REASONS,
  type ConductorTruckInventorySummary,
} from "@/lib/conductor-truck-inventory";
import { buildLogisticaShipmentDeepLink } from "@/lib/logistics-view";
import { buildMapsNavigationUrl } from "@/lib/logistics-navigation";
import { estimateRouteStopEtaMinutes, formatEtaMinutes } from "@/lib/logistics-eta";
import { formatScheduleAtDisplay } from "@/components/sale/schedule-time";

type ConductorTareasClientProps = {
  canPreview?: boolean;
  drivers?: ConductorDriverOption[];
  previewDriverId?: string | null;
  effectiveDriverId?: string | null;
  effectiveDriverLabel: string;
  initialTasks?: ConductorDriverTask[];
  initialTruckSummary?: ConductorTruckInventorySummary | null;
  initialHistory?: ActivityHistoryRow[];
};

type TaskDialogState = {
  task: ConductorDriverTask;
  result: "completed" | "failed";
};

export function ConductorTareasClient({
  canPreview = false,
  drivers = [],
  previewDriverId = null,
  effectiveDriverId = null,
  effectiveDriverLabel,
  initialTasks = [],
  initialTruckSummary = null,
  initialHistory = [],
}: ConductorTareasClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const notify = useNotify();
  const previewOptions = buildConductorPreviewPickerOptions(drivers);
  const [doneTaskIds, setDoneTaskIds] = useState<string[]>([]);
  const [dialog, setDialog] = useState<TaskDialogState | null>(null);
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<ActivityHistoryRow[]>(initialHistory);
  const [failureReason, setFailureReason] = useState<string>(CONDUCTOR_TASK_FAILURE_REASONS[0]);
  const [note, setNote] = useState("");
  const [evidence, setEvidence] = useState<File | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");

  const tasks = useMemo(
    () => initialTasks.filter((task) => !doneTaskIds.includes(task.id)),
    [doneTaskIds, initialTasks],
  );

  useEffect(() => {
    setHistory(initialHistory);
  }, [initialHistory]);

  const refreshHistory = useCallback(async () => {
    if (!effectiveDriverId) {
      return;
    }

    const historyResult = await listConductorTaskActivityHistoryAction(effectiveDriverId);

    if (historyResult.ok) {
      setHistory(historyResult.data);
    }
  }, [effectiveDriverId]);

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
    setPaymentAmount(task.depositDue > 0 ? String(task.depositDue) : "");
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

    setSaving(true);

    try {
      const formData = new FormData();
      formData.set("taskId", dialog.task.id);
      formData.set("result", dialog.result);
      formData.set("failureReason", failureReason);
      formData.set("note", note);
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
      const failed = dialog.result === "failed";
      setDialog(null);
      notify.success(dialog.result === "completed" ? "Tarea completada" : "Visita cancelada");

      if (failed) {
        setHistoryOpen(true);
        await refreshHistory();
      }

      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const emptyMessage = canPreview
    ? effectiveDriverId
      ? "Sin tareas por ahora"
      : "No hay conductores activos"
    : "Sin tareas por ahora";

  const emptyDetail = canPreview
    ? effectiveDriverId
      ? `Vista de ${effectiveDriverLabel}. Puedes completar tareas en su nombre; queda registrado como admin.`
      : "Crea o activa conductores en Logistica para previsualizar su vista."
    : "Aqui veras recogidas, entregas y paradas de tu ruta del dia.";

  const shortageTotal = initialTruckSummary?.shortageTotal ?? 0;
  const routeBlocked = shortageTotal > 0;

  return (
    <div className="flex min-h-0 flex-col lg:flex-1 lg:overflow-hidden">
      <Panel
        title={canPreview ? "Tareas conductor" : "Mis tareas"}
        contentClassName="flex min-h-0 flex-1 flex-col p-4 sm:p-5"
      >
        {canPreview ? (
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-sky-700/50 bg-sky-950/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase text-sky-300">Vista previa admin</p>
              <p className="text-sm font-bold text-sky-100">
                Vista del conductor. Puedes actuar en su nombre; queda registrado como admin.
              </p>
            </div>
            <InlineSearchPicker
              value={previewDriverId || ""}
              onChange={handlePreviewDriverChange}
              options={previewOptions}
              placeholder="Elegir conductor"
              searchPlaceholder="Buscar conductor"
              emptyLabel="Sin conductores"
              ariaLabel="Conductor a previsualizar"
              minWidthClass="min-w-[12rem] sm:min-w-[16rem]"
              disabled={!previewOptions.length}
            />
          </div>
        ) : null}

        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-black bg-surface-card px-4 py-3 sm:flex-row sm:items-center">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-black bg-emerald-400 text-slate-950">
            <Truck className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase text-slate-500">Conductor</p>
            <p className="truncate text-lg font-black text-[#f8fafc]">{effectiveDriverLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black text-slate-400">
              {tasks.length} {tasks.length === 1 ? "tarea" : "tareas"}
            </p>
            <button
              type="button"
              className={`${secondaryButtonClass} h-10 text-xs`}
              onClick={() => setHistoryOpen((current) => !current)}
            >
              <History className="h-4 w-4" />
              Historial
              {history.length ? (
                <span className="rounded-full border border-black bg-surface-inset px-2 py-0.5 text-[10px] font-black text-slate-300">
                  {history.length}
                </span>
              ) : null}
            </button>
          </div>
        </div>

        {historyOpen ? (
          <div className="mb-4 rounded-xl border border-black bg-surface-card p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-black uppercase text-slate-400">Historial</p>
              <span className="rounded-full border border-black bg-surface-inset px-2 py-0.5 text-[10px] font-black text-slate-300">
                {history.length}
              </span>
            </div>
            {history.length ? (
              <ol className="grid max-h-64 gap-2 overflow-y-auto pr-1">
                {history.map((entry) => {
                  const shipmentCode =
                    typeof entry.metadata?.shipmentCode === "string"
                      ? entry.metadata.shipmentCode
                      : "";
                  const logisticaHref = shipmentCode
                    ? buildLogisticaShipmentDeepLink(shipmentCode)
                    : null;

                  return (
                  <li key={entry.id}>
                    <AuditHistoryEntry entry={entry} className="bg-surface-inset" />
                    {entry.action === "shipment.logistics_task_failed" && logisticaHref ? (
                      <Link
                        href={logisticaHref}
                        className="mt-1 inline-flex text-xs font-black text-emerald-300"
                      >
                        Reprogramar en logística
                      </Link>
                    ) : null}
                  </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-sm font-bold text-slate-400">Sin movimientos registrados todavía.</p>
            )}
          </div>
        ) : null}

        {routeBlocked ? (
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-rose-800/70 bg-rose-950/35 px-4 py-3 sm:flex-row sm:items-center">
            <AlertTriangle className="h-5 w-5 shrink-0 text-rose-300" />
            <p className="min-w-0 flex-1 text-sm font-black text-rose-100">
              Faltan {shortageTotal} cajas. No inicies ruta hasta cargar camion.
            </p>
            <Link href="/conductor/inventario-camion" className={`${secondaryButtonClass} h-10 text-xs`}>
              Inventario camion
            </Link>
          </div>
        ) : null}

        {tasks.length ? (
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="grid items-start gap-2.5 lg:grid-cols-2 xl:grid-cols-3">
              {tasks.map((task) => {
                const successDisabled =
                  task.taskType === "deliver_empty_box" && routeBlocked && task.status !== "loaded_to_truck";

                return (
                  <article key={task.id} className={`${cardClass} flex flex-col overflow-hidden p-0`}>
                    <div className="border-b border-black bg-surface-card-header px-3 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase text-emerald-300">
                            {conductorTaskTypeLabel[task.taskType]}
                          </p>
                          <p className="truncate text-base font-black text-[#f8fafc]">
                            {task.shipmentCode}
                          </p>
                          <p className="truncate text-xs font-black text-slate-300">
                            {task.customerName}
                          </p>
                          {task.customerPhone ? (
                            <p className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-[11px] font-black text-slate-400">
                              <Phone className="h-3 w-3 shrink-0" />
                              <span className="truncate">{task.customerPhone}</span>
                            </p>
                          ) : null}
                        </div>
                        <span
                          className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-black ${conductorTaskStatusClass(task.status)}`}
                        >
                          {logisticsTaskStatusLabel[task.status]}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col gap-3 p-3">
                      {task.addressLine ? (
                        <div className="grid gap-2">
                          <p className="line-clamp-2 rounded-md border border-black bg-surface-inset px-2 py-1 text-xs font-bold leading-snug text-slate-300">
                            <MapPin className="mr-1 inline h-3.5 w-3.5 shrink-0 text-slate-500" />
                            {task.addressLine}
                            {task.zoneLabel ? (
                              <span className="text-slate-500"> · {task.zoneLabel}</span>
                            ) : null}
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
                        <p className="text-sm font-bold text-slate-300">
                          {formatScheduleAtDisplay(task.scheduledAt)}
                        </p>
                      ) : null}

                      {task.routeName ? (
                        <p className="text-sm font-bold text-slate-400">
                          Ruta {task.routeName}
                          {task.stopOrder ? ` - parada ${task.stopOrder}` : ""}
                          {task.stopOrder &&
                          formatEtaMinutes(estimateRouteStopEtaMinutes(task.stopOrder))
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

                      {task.customerPhone ? (
                        <a
                          className={`${secondaryButtonClass} h-10 text-xs`}
                          href={`tel:${task.customerPhone}`}
                        >
                          <Phone className="h-4 w-4" />
                          Llamar
                        </a>
                      ) : null}

                      {task.boxSummary ? (
                        <p className="mt-auto rounded-md border border-black bg-[#26312c] px-3 py-2 text-center text-sm font-black tabular-nums tracking-tight text-[#f8fafc]">
                          <Boxes className="mr-1.5 inline h-4 w-4 shrink-0 text-emerald-300" />
                          {task.boxSummary}
                        </p>
                      ) : null}

                      <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        className={`${primaryButtonClass} h-11 text-xs disabled:cursor-not-allowed disabled:opacity-40`}
                        disabled={successDisabled}
                        onClick={() => openDialog(task, "completed")}
                      >
                        <PackageCheck className="h-4 w-4" />
                        {task.taskType === "deliver_empty_box" ? "Entregado" : "Recogido"}
                      </button>
                      <button
                        type="button"
                        className={`${secondaryButtonClass} h-11 text-xs disabled:cursor-not-allowed disabled:opacity-40`}
                        onClick={() => openDialog(task, "failed")}
                      >
                        <XCircle className="h-4 w-4" />
                        No se pudo
                      </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex min-h-[14rem] flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-black/70 bg-surface-card/40 px-6 py-10 text-center">
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
                  {dialog.task.shipmentCode} - {dialog.task.customerName}
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

              {dialog.result === "completed" && dialog.task.taskType === "deliver_empty_box" && dialog.task.balanceDue > 0 ? (
                <div className="grid gap-3 rounded-lg border border-black bg-surface-card p-3">
                  <p className="text-xs font-black uppercase text-slate-500">Cobro</p>
                  <label className="grid gap-1 text-[10px] font-black uppercase text-slate-500">
                    Monto
                    <input
                      className={inputClass}
                      value={paymentAmount}
                      disabled={saving}
                      inputMode="decimal"
                      placeholder={formatMoneyValue(dialog.task.depositDue || dialog.task.balanceDue)}
                      onChange={(event) => setPaymentAmount(event.target.value)}
                    />
                  </label>
                  <label className="grid gap-1 text-[10px] font-black uppercase text-slate-500">
                    Metodo
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
                  disabled={saving || (dialog.result === "completed" && !evidence)}
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
    </div>
  );
}
