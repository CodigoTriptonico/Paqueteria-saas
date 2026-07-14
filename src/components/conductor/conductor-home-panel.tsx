import Link from "next/link";
import { AlertTriangle, Boxes, CheckCircle2, ChevronRight, ListTodo, Truck } from "lucide-react";
import type { ConductorHomeVehicleStatus } from "@/app/actions/conductor-tasks";
import { BigAction, labelMutedClass, Panel, StatCard, textMutedClass } from "@/components/ui-blocks";
import type { ConductorTaskSummary } from "@/lib/conductor-dashboard";
import type { ConductorTruckInventorySummary } from "@/lib/conductor-truck-inventory";

type ConductorHomePanelProps = {
  driverLabel: string;
  summary: ConductorTaskSummary;
  truckSummary: ConductorTruckInventorySummary | null;
  vehicleStatus: ConductorHomeVehicleStatus | null;
};

function DeliverBoxesCard({
  deliverCount,
  truckSummary,
}: {
  deliverCount: number;
  truckSummary: ConductorTruckInventorySummary | null;
}) {
  const onTruck = truckSummary?.currentTotal ?? 0;
  const toLoad = truckSummary?.shortageTotal ?? 0;
  const needsLoading = toLoad > 0;
  const truckEmpty = onTruck === 0;
  const inventoryHref = needsLoading ? "/conductor/inventario-camion?subir=1" : "/conductor/inventario-camion";

  return (
    <div className="overflow-hidden rounded-lg border border-black bg-surface-card shadow-[0_6px_20px_rgba(0,0,0,0.18)]">
      <p className="border-b border-black bg-surface-card-header px-3 py-2 text-xs font-black uppercase text-slate-400">
        Cajas por dejar
      </p>
      <div className="px-3 py-3">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-3xl font-black tabular-nums text-emerald-300">{deliverCount}</span>
          {truckEmpty && needsLoading ? (
            <span className="text-sm font-bold text-slate-400">y por subir al camión</span>
          ) : null}
        </div>

        {onTruck > 0 && needsLoading ? (
          <Link
            href={inventoryHref}
            className="mt-1.5 inline-flex max-w-full items-center gap-1 text-left text-xs font-bold leading-snug text-slate-400 transition hover:text-emerald-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
          >
            <span>
              Ya tienes <span className="font-black text-slate-200">{onTruck}</span> en el camión. Te faltan{" "}
              <span className="font-black text-rose-200">{toLoad}</span> por subir.
            </span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-emerald-300/80" />
          </Link>
        ) : truckEmpty && needsLoading ? (
          <Link
            href={inventoryHref}
            className="mt-1.5 inline-flex max-w-full items-center gap-1 text-left text-xs font-bold text-slate-400 transition hover:text-emerald-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
          >
            <span>
              <span className="font-black text-rose-200">{toLoad}</span> pendientes por subir al camión
            </span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-emerald-300/80" />
          </Link>
        ) : onTruck > 0 && !needsLoading ? (
          <Link
            href={inventoryHref}
            className="mt-1.5 inline-flex max-w-full items-center gap-1 text-left text-xs font-bold text-emerald-300/80 transition hover:text-emerald-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
          >
            <span>
              {onTruck} en el camión · Carga lista
            </span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          </Link>
        ) : deliverCount === 0 ? (
          <p className="mt-1.5 text-xs font-bold text-slate-500">Sin entregas pendientes</p>
        ) : null}

        {needsLoading ? (
          <Link
            href="/conductor/inventario-camion?subir=1"
            className="mt-2.5 inline-flex items-center gap-1 rounded-md border border-emerald-700/60 bg-emerald-950/35 px-2.5 py-1.5 text-[11px] font-black text-emerald-200 transition hover:bg-emerald-950/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
          >
            Ver cajas por subir
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function ConductorHomePanel({
  driverLabel,
  summary,
  truckSummary,
  vehicleStatus,
}: ConductorHomePanelProps) {
  const hasWork = summary.totalTasks > 0;
  const vehicleReady = vehicleStatus?.status === "active";
  const vehicleStatusLabel =
    vehicleStatus?.status === "active"
      ? vehicleStatus.routeStatus === "in_progress"
        ? "En ruta"
        : "Activo"
      : vehicleStatus?.status === "inactive"
        ? "Vehículo inactivo"
        : vehicleStatus?.status === "unassigned"
          ? "Sin vehículo asignado"
          : "Sin ruta asignada";

  return (
    <Panel title="Inicio" hideHeader>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={labelMutedClass}>Ruta del día</p>
          <h3 className="truncate text-2xl font-black text-[#f8fafc]">Hola, {driverLabel}</h3>
          <p className={`mt-1 ${textMutedClass}`}>
            {hasWork
              ? "Resumen de lo que tienes pendiente en calle."
              : "Sin tareas asignadas por ahora."}
          </p>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <DeliverBoxesCard deliverCount={summary.deliverCount} truckSummary={truckSummary} />
        <StatCard
          label="Cajas por recoger"
          value={String(summary.pickupCount)}
          tone="text-amber-300"
        />
      </div>

      <section className={`mb-4 flex items-center gap-3 rounded-xl border px-4 py-3 ${
        vehicleReady ? "border-emerald-700/60 bg-emerald-950/20" : "border-rose-800/60 bg-rose-950/25"
      }`}>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-black ${
          vehicleReady ? "bg-emerald-400 text-slate-950" : "bg-rose-400 text-slate-950"
        }`}>
          <Truck className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={labelMutedClass}>Vehículo de hoy</p>
          <p className="truncate text-base font-black text-[#f8fafc]">
            {vehicleStatus?.vehicleLabel || "Sin vehículo asignado"}
          </p>
          <p className="truncate text-xs font-bold text-slate-400">
            {vehicleStatus?.routeName || "No tienes una ruta asignada hoy."}
          </p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-black ${
          vehicleReady
            ? "border-emerald-700/60 bg-emerald-950/35 text-emerald-200"
            : "border-rose-800/60 bg-rose-950/35 text-rose-200"
        }`}>
          {vehicleReady ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
          {vehicleStatusLabel}
        </span>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <BigAction
          title="Inventario camion"
          text="Carga cajas antes de iniciar ruta."
          icon={Boxes}
          color="bg-emerald-400"
          href="/conductor/inventario-camion"
        />
        <BigAction
          title="Ver mis tareas"
          text="Direcciones, horarios y estados de tu ruta."
          icon={ListTodo}
          color="bg-emerald-400"
          href="/conductor/tareas"
        />
      </div>
    </Panel>
  );
}
