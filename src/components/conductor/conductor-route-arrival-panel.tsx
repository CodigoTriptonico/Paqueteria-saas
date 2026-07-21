"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  MapPin,
  MessageSquareText,
  Truck,
  Warehouse,
  X,
} from "lucide-react";
import { completeConductorRouteArrivalAction } from "@/app/actions/conductor-tasks";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import { useNotify } from "@/hooks/use-notify";
import {
  conductorRouteArrivalReasonHelp,
  conductorRouteArrivalReasonLabel,
  conductorRouteArrivalReasons,
  validateConductorRouteArrival,
  type ConductorRouteArrivalReason,
  type ConductorRouteArrivalWorkspace,
  type ConductorRouteReadyForArrival,
} from "@/lib/conductor-route-arrival";

const reasonIcon = {
  completed_normally: CheckCircle2,
  unfinished_stops: AlertTriangle,
  vehicle_problem: Truck,
  other: MessageSquareText,
} satisfies Record<ConductorRouteArrivalReason, typeof CheckCircle2>;

function newOperationKey() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
}

export function ConductorRouteArrivalPanel({
  initialWorkspace,
  driverId,
}: {
  initialWorkspace: ConductorRouteArrivalWorkspace;
  driverId: string | null;
}) {
  const router = useRouter();
  const notify = useNotify();
  const [finishedRouteIds, setFinishedRouteIds] = useState<string[]>([]);
  const [target, setTarget] = useState<ConductorRouteReadyForArrival | null>(null);
  const [warehouseId, setWarehouseId] = useState("");
  const [reason, setReason] = useState<ConductorRouteArrivalReason>("completed_normally");
  const [note, setNote] = useState("");
  const [operationKey, setOperationKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selectedWarehouse = useMemo(
    () => initialWorkspace.warehouses.find((warehouse) => warehouse.id === warehouseId) || null,
    [initialWorkspace.warehouses, warehouseId],
  );
  const routes = initialWorkspace.routes.filter((route) => !finishedRouteIds.includes(route.id));

  if (!routes.length) return null;

  function openArrival(route: ConductorRouteReadyForArrival) {
    const preferredWarehouse = initialWorkspace.warehouses.find((warehouse) => warehouse.id === route.plannedWarehouseId)
      || initialWorkspace.warehouses.find((warehouse) => warehouse.isDefault)
      || initialWorkspace.warehouses[0]
      || null;
    setTarget(route);
    setWarehouseId(preferredWarehouse?.id || "");
    setReason(route.exceptionStops > 0 ? "unfinished_stops" : "completed_normally");
    setNote("");
    setOperationKey(newOperationKey());
    setError("");
  }

  function closeArrival() {
    if (saving) return;
    setTarget(null);
    setError("");
  }

  async function finishRoute() {
    if (!target || saving) return;
    const validation = validateConductorRouteArrival({
      warehouseId,
      reason,
      note,
      hasExceptions: target.exceptionStops > 0,
    });
    if (!validation.ok) {
      setError(validation.error);
      return;
    }
    if (target.plannedWarehouseId && target.plannedWarehouseId !== warehouseId && note.trim().length < 3) {
      setError("Escribe por qué dejaste las cajas en otra bodega.");
      return;
    }
    if (!navigator.onLine) {
      setError("No hay señal. Tus visitas están guardadas; intenta terminar la ruta cuando vuelva la conexión.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const result = await completeConductorRouteArrivalAction({
        routeId: target.id,
        warehouseId,
        reason,
        note,
        capturedAt: new Date().toISOString(),
        operationKey,
        driverId,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setFinishedRouteIds((current) => [...current, target.id]);
      setTarget(null);
      notify.success("Ruta terminada. Bodega avisada.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="mb-3 overflow-hidden rounded-xl border border-emerald-800/70 bg-emerald-950/25 shadow-[0_8px_22px_rgba(0,0,0,0.18)]">
        {routes.map((route) => (
          <div key={route.id} className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-700/70 bg-emerald-400 text-slate-950">
                <Warehouse className="h-6 w-6" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wide text-emerald-300">Último paso</p>
                <h2 className="truncate text-lg font-black text-slate-50">Ya terminaste las paradas</h2>
                <p className="mt-0.5 truncate text-sm font-bold text-slate-300">{route.name} · {route.vehicleLabel}</p>
              </div>
            </div>
            <button type="button" onClick={() => openArrival(route)} className={`${primaryButtonClass} min-h-14 w-full px-5 text-base sm:w-auto`}>
              <MapPin className="h-5 w-5" /> Llegué a bodega
            </button>
          </div>
        ))}
      </section>

      {target ? (
        <div className="fixed inset-0 z-[170] flex items-end justify-center bg-black/75 sm:items-center sm:p-4">
          <button type="button" aria-label="Todavía no" className="absolute inset-0" onClick={closeArrival} disabled={saving} />
          <section role="dialog" aria-modal="true" aria-labelledby="route-arrival-title" className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-black bg-surface-panel p-4 pb-8 shadow-2xl sm:rounded-2xl sm:p-5">
            <header className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-emerald-300">Haz esto dentro de la bodega</p>
                <h2 id="route-arrival-title" className="mt-1 text-2xl font-black text-slate-50">Terminar ruta</h2>
                <p className="mt-1 text-sm font-bold text-slate-400">Toca una bodega y una razón.</p>
              </div>
              <button type="button" onClick={closeArrival} disabled={saving} aria-label="Todavía no" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-black bg-surface-inset text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="mt-5">
              <p className="text-sm font-black text-slate-100">¿Dónde dejaste las cajas?</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {initialWorkspace.warehouses.map((warehouse) => {
                  const selected = warehouse.id === warehouseId;
                  return (
                    <button key={warehouse.id} type="button" aria-pressed={selected} onClick={() => { setWarehouseId(warehouse.id); setError(""); }} className={`flex min-h-14 items-center gap-3 rounded-xl border p-3 text-left ${selected ? "border-emerald-500 bg-emerald-950/45 text-emerald-100" : "border-black bg-surface-inset text-slate-200"}`}>
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black ${selected ? "bg-emerald-400 text-slate-950" : "bg-surface-card text-slate-400"}`}>
                        {selected ? <Check className="h-5 w-5" /> : <Warehouse className="h-5 w-5" />}
                      </span>
                      <span className="min-w-0"><span className="block truncate text-base font-black">{warehouse.name}</span>{warehouse.code ? <span className="block text-xs font-bold text-slate-400">{warehouse.code}</span> : null}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 border-t border-black pt-5">
              <p className="text-sm font-black text-slate-100">¿Por qué terminaste?</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {conductorRouteArrivalReasons.map((value) => {
                  const Icon = reasonIcon[value];
                  const selected = value === reason;
                  const unavailable = value === "completed_normally" && target.exceptionStops > 0;
                  return (
                    <button key={value} type="button" aria-pressed={selected} disabled={unavailable} onClick={() => { setReason(value); setError(""); }} className={`min-h-[4.5rem] rounded-xl border p-3 text-left disabled:cursor-not-allowed disabled:opacity-35 ${selected ? "border-emerald-500 bg-emerald-950/45" : "border-black bg-surface-inset"}`}>
                      <span className="flex items-center gap-2"><Icon className={`h-5 w-5 shrink-0 ${selected ? "text-emerald-300" : "text-slate-500"}`} /><span className="text-sm font-black text-slate-100">{conductorRouteArrivalReasonLabel[value]}</span></span>
                      <span className="mt-1 block text-xs font-bold leading-4 text-slate-400">{conductorRouteArrivalReasonHelp[value]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {reason === "other" || (target.plannedWarehouseId && target.plannedWarehouseId !== warehouseId) ? (
              <label className="mt-4 grid gap-1.5 text-sm font-black text-slate-100">
                {target.plannedWarehouseId && target.plannedWarehouseId !== warehouseId ? "¿Por qué cambiaste de bodega?" : "¿Qué pasó?"}
                <textarea value={note} onChange={(event) => { setNote(event.target.value); setError(""); }} className={`${inputClass} min-h-24 w-full py-3 text-base`} placeholder="Escribe pocas palabras" maxLength={500} />
              </label>
            ) : null}

            {error ? <div role="alert" className="mt-4 rounded-xl border border-rose-900 bg-rose-950/35 p-3 text-sm font-black leading-5 text-rose-100">{error}</div> : null}

            <div className="mt-5 rounded-xl border border-black bg-surface-card p-3 text-center">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Vas a confirmar</p>
              <p className="mt-1 text-base font-black text-slate-100">Dejaste las cajas en {selectedWarehouse?.name || "la bodega elegida"}.</p>
            </div>
            <div className="mt-4 grid grid-cols-[0.8fr_1.2fr] gap-2">
              <button type="button" onClick={closeArrival} disabled={saving} className={`${secondaryButtonClass} min-h-14 text-sm`}>Todavía no</button>
              <button type="button" onClick={() => void finishRoute()} disabled={saving} className={`${primaryButtonClass} min-h-14 text-sm disabled:cursor-wait disabled:opacity-60`}>
                {saving ? "Guardando..." : "Sí, terminar ruta"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
