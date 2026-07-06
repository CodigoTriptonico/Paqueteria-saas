"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Boxes, CheckCircle2, Loader2, PackageCheck, RotateCcw, Truck } from "lucide-react";
import {
  getConductorTruckInventoryAction,
  loadConductorTruckLineAction,
  returnConductorTruckLineAction,
  startConductorRouteAction,
  type ConductorTruckInventoryView,
} from "@/app/actions/conductor-tasks";
import { InlineSearchPicker } from "@/components/inline-search-picker";
import {
  cardClass,
  Panel,
  primaryButtonClass,
  secondaryButtonClass,
  textMutedClass,
} from "@/components/ui-blocks";
import { useNotify } from "@/hooks/use-notify";
import {
  buildConductorPreviewPickerOptions,
  type ConductorDriverOption,
} from "@/lib/conductor-tareas-view";

type ConductorTruckInventoryClientProps = {
  canPreview?: boolean;
  drivers?: ConductorDriverOption[];
  previewDriverId?: string | null;
  effectiveDriverId?: string | null;
  effectiveDriverLabel: string;
  initialView?: ConductorTruckInventoryView | null;
  initialError?: string;
};

type LocalTruckResult = {
  driverId: string | null;
  view: ConductorTruckInventoryView | null;
  error: string;
};

export function ConductorTruckInventoryClient({
  canPreview = false,
  drivers = [],
  previewDriverId = null,
  effectiveDriverId = null,
  effectiveDriverLabel,
  initialView = null,
  initialError = "",
}: ConductorTruckInventoryClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const notify = useNotify();
  const previewOptions = buildConductorPreviewPickerOptions(drivers);
  const [localResult, setLocalResult] = useState<LocalTruckResult | null>(null);
  const [busyKey, setBusyKey] = useState("");
  const localResultMatches = localResult?.driverId === effectiveDriverId;
  const view = localResultMatches ? localResult.view : initialView;
  const error = localResultMatches ? localResult.error : initialError;

  const handlePreviewDriverChange = useCallback(
    (nextDriverId: string) => {
      const params = new URLSearchParams(searchParams.toString());

      if (nextDriverId) {
        params.set("conductor", nextDriverId);
      } else {
        params.delete("conductor");
      }

      const query = params.toString();
      router.replace(query ? `/conductor/inventario-camion?${query}` : "/conductor/inventario-camion", {
        scroll: false,
      });
    },
    [router, searchParams],
  );

  async function refreshTruck() {
    if (!effectiveDriverId) {
      return;
    }

    const result = await getConductorTruckInventoryAction(effectiveDriverId);
    if (result.ok) {
      setLocalResult({ driverId: result.data.driverId, view: result.data, error: "" });
    }
  }

  async function loadLine(lineKey: string, qty: number) {
    setBusyKey(`load:${lineKey}`);

    try {
      const result = await loadConductorTruckLineAction({
        driverId: canPreview ? effectiveDriverId : null,
        lineKey,
        qty,
      });

      if (!result.ok) {
        notify.error(result.error);
        return;
      }

      setLocalResult({ driverId: result.data.driverId, view: result.data, error: "" });
      notify.success("Caja cargada");
    } finally {
      setBusyKey("");
    }
  }

  async function returnLine(lineKey: string, qty: number) {
    setBusyKey(`return:${lineKey}`);

    try {
      const result = await returnConductorTruckLineAction({
        driverId: canPreview ? effectiveDriverId : null,
        lineKey,
        qty,
      });

      if (!result.ok) {
        notify.error(result.error);
        return;
      }

      setLocalResult({ driverId: result.data.driverId, view: result.data, error: "" });
      notify.success("Caja devuelta");
    } finally {
      setBusyKey("");
    }
  }

  async function startRoute() {
    setBusyKey("start");

    try {
      const result = await startConductorRouteAction(canPreview ? effectiveDriverId : null);

      if (!result.ok) {
        notify.error(result.error);
        await refreshTruck();
        return;
      }

      setLocalResult({ driverId: result.data.driverId, view: result.data, error: "" });
      notify.success("Ruta iniciada");
      router.push("/conductor/tareas");
    } finally {
      setBusyKey("");
    }
  }

  const summary = view?.summary;
  const lines = summary?.lines ?? [];
  const ready = Boolean(summary?.ready);
  const hasRequiredBoxes = Boolean(summary && summary.requiredTotal > 0);

  return (
    <div className="flex min-h-0 flex-col lg:flex-1 lg:overflow-hidden">
      <Panel
        title="Inventario camion"
        contentClassName="flex min-h-0 flex-1 flex-col p-4 sm:p-5"
      >
        {canPreview ? (
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-sky-700/50 bg-sky-950/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase text-sky-300">Vista previa admin</p>
              <p className="text-sm font-bold text-sky-100">Carga como la ve el conductor.</p>
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
          <Link
            href="/conductor/tareas"
            className={`${secondaryButtonClass} h-10 px-3 text-xs`}
          >
            Ver tareas
          </Link>
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-rose-900/70 bg-rose-950/35 px-4 py-3 text-sm font-black text-rose-100">
            {error}
          </div>
        ) : null}

        {summary ? (
          <div className="mb-4 grid gap-2 sm:grid-cols-4">
            <Metric label="Requeridas" value={summary.requiredTotal} tone="text-[#f8fafc]" />
            <Metric label="En camion" value={summary.currentTotal} tone="text-emerald-300" />
            <Metric label="Cargadas" value={summary.loadedTotal} tone="text-sky-300" />
            <Metric label="Faltan" value={summary.shortageTotal} tone={summary.shortageTotal ? "text-rose-300" : "text-emerald-300"} />
          </div>
        ) : null}

        {summary && !ready ? (
          <div className="mb-4 rounded-xl border border-rose-800/70 bg-rose-950/35 px-4 py-3">
            <p className="text-sm font-black text-rose-100">
              No inicies ruta. Faltan {summary.shortageTotal} cajas.
            </p>
          </div>
        ) : null}

        {summary && ready && hasRequiredBoxes ? (
          <div className="mb-4 rounded-xl border border-emerald-800/70 bg-emerald-950/25 px-4 py-3">
            <p className="text-sm font-black text-emerald-100">Carga lista.</p>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {lines.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {lines.map((line) => {
                const missing = line.shortageQty > 0;
                const canLoad = missing && line.stockQty >= line.shortageQty && !canPreview;
                const canReturn = line.currentQty > 0 && !canPreview;

                return (
                  <article
                    key={line.key}
                    className={`${cardClass} overflow-hidden ${missing ? "bg-rose-950/20" : ""}`}
                  >
                    <div className="flex items-start gap-3 border-b border-black bg-surface-card-header px-3 py-3">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-black ${missing ? "bg-rose-400 text-slate-950" : "bg-emerald-400 text-slate-950"}`}>
                        {missing ? <Boxes className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-black text-[#f8fafc]">{line.label}</p>
                        <p className="mt-0.5 text-xs font-bold text-slate-400">
                          Stock bodega {line.stockQty}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 divide-x divide-black border-b border-black">
                      <SmallMetric label="Debe" value={line.requiredQty} />
                      <SmallMetric label="Camion" value={line.currentQty} />
                      <SmallMetric label="Falta" value={line.shortageQty} tone={missing ? "text-rose-300" : "text-emerald-300"} />
                    </div>

                    <div className="grid gap-2 p-3 sm:grid-cols-2">
                      <button
                        type="button"
                        className={`${primaryButtonClass} h-11 text-xs disabled:cursor-not-allowed disabled:opacity-40`}
                        disabled={!canLoad || busyKey === `load:${line.key}`}
                        onClick={() => void loadLine(line.key, line.shortageQty)}
                      >
                        {busyKey === `load:${line.key}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
                        Cargar
                      </button>
                      <button
                        type="button"
                        className={`${secondaryButtonClass} h-11 text-xs disabled:cursor-not-allowed disabled:opacity-40`}
                        disabled={!canReturn || busyKey === `return:${line.key}`}
                        onClick={() => void returnLine(line.key, Math.max(line.currentQty - line.requiredQty, 0) || line.currentQty)}
                      >
                        {busyKey === `return:${line.key}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                        Devolver
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-[14rem] flex-col items-center justify-center rounded-xl border border-dashed border-black/70 bg-surface-card/40 px-6 py-10 text-center">
              <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-black bg-surface-inset text-slate-300">
                <Boxes className="h-7 w-7" />
              </span>
              <p className="text-xl font-black text-[#f8fafc]">Sin cajas por cargar</p>
              <p className={`mt-2 max-w-md ${textMutedClass}`}>
                Las recogidas de caja llena no bloquean ruta.
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-2 border-t border-black pt-4 sm:grid-cols-[1fr_auto]">
          <p className="text-sm font-bold text-slate-300">
            {ready ? "Puedes salir a ruta." : "Carga las faltantes antes de salir."}
          </p>
          <button
            type="button"
            className={`${primaryButtonClass} h-12 px-5 text-sm disabled:cursor-not-allowed disabled:opacity-40`}
            disabled={!ready || !hasRequiredBoxes || Boolean(busyKey) || canPreview}
            onClick={() => void startRoute()}
          >
            {busyKey === "start" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
            Iniciar ruta
          </button>
        </div>
      </Panel>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-black bg-surface-card p-3">
      <p className="text-[10px] font-black uppercase text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-black tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function SmallMetric({ label, value, tone = "text-[#f8fafc]" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="min-w-0 bg-surface-inset px-3 py-2">
      <p className="text-[9px] font-black uppercase text-slate-500">{label}</p>
      <p className={`mt-1 truncate text-lg font-black tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}
