import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ClipboardList, PackagePlus, Truck, Users } from "lucide-react";
import {
  getConductorHomeVehicleStatusAction,
  getConductorTruckInventoryAction,
  listConductorDriverTasksAction,
  type ConductorHomeVehicleStatus,
} from "@/app/actions/conductor-tasks";
import { ConductorHomePanel } from "@/components/conductor/conductor-home-panel";
import { DashboardSummary } from "@/components/dashboard-summary";
import { BigAction, cardClass, labelMutedClass, Panel, textMutedClass } from "@/components/ui-blocks";
import { SupabaseRequiredBanner } from "@/components/supabase-required-banner";
import { platformAdminNeedsClientContext } from "@/lib/auth/permissions";
import { getAppSession } from "@/lib/auth/session";
import { summarizeConductorTasks } from "@/lib/conductor-dashboard";
import type { ConductorTruckInventorySummary } from "@/lib/conductor-truck-inventory";
import { isConductorRole } from "@/lib/conductor-tareas-view";
import { loadDashboardSummaryForSession } from "@/lib/dashboard/summary";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const actions = [
  {
    title: "Nueva venta",
    text: "Crear envio o vender caja.",
    icon: PackagePlus,
    color: "bg-emerald-400",
    href: "/venta",
  },
  {
    title: "Clientes",
    text: "Remitentes y destinatarios.",
    icon: Users,
    color: "bg-emerald-400",
    href: "/venta",
  },
  {
    title: "Pickups",
    text: "Recoger o entregar cajas.",
    icon: Truck,
    color: "bg-emerald-400",
    href: "/logistica",
  },
  {
    title: "Seguimiento",
    text: "Envíos activos en curso.",
    icon: ClipboardList,
    color: "bg-emerald-400",
    href: "/seguimiento",
  },
];

const [primaryAction, ...secondaryActions] = actions;

export default async function Home() {
  const session = await getAppSession();
  if (session && platformAdminNeedsClientContext(session)) {
    redirect("/platform");
  }

  const isConductor = Boolean(session && isConductorRole(session.roleSlug));
  const supabaseReady = isSupabaseConfigured() && Boolean(session);
  let initialSummary = null;
  let conductorSummary = summarizeConductorTasks([]);
  let conductorVehicleStatus: ConductorHomeVehicleStatus | null = null;
  let conductorTruckSummary: ConductorTruckInventorySummary | null = null;

  if (supabaseReady && session) {
    if (isConductor) {
      const [tasksResult, vehicleStatusResult, truckResult] = await Promise.all([
        listConductorDriverTasksAction(session.userId),
        getConductorHomeVehicleStatusAction(session.userId),
        getConductorTruckInventoryAction(session.userId),
      ]);
      conductorSummary = summarizeConductorTasks(tasksResult.ok ? tasksResult.data : []);
      conductorVehicleStatus = vehicleStatusResult.ok ? vehicleStatusResult.data : null;
      conductorTruckSummary = truckResult.ok ? truckResult.data.summary : null;
    } else {
      try {
        initialSummary = await loadDashboardSummaryForSession(session);
      } catch {
        initialSummary = null;
      }
    }
  }

  if (isConductor) {
    return (
      <ConductorHomePanel
        driverLabel={session?.fullName || session?.email || "Conductor"}
        summary={conductorSummary}
        truckSummary={conductorTruckSummary}
        vehicleStatus={conductorVehicleStatus}
      />
    );
  }

  return (
    <>
      <Panel title="Inicio" hideHeader>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className={labelMutedClass}>Resumen</p>
            <h3 className="truncate text-2xl font-black text-[#f8fafc]">Inicio</h3>
          </div>
        </div>

        {!isSupabaseConfigured() ? (
          <SupabaseRequiredBanner detail="El panel de resumen mostrará métricas cuando existan ventas y envíos en Supabase." />
        ) : null}

        {supabaseReady ? (
          <DashboardSummary initialSummary={initialSummary} />
        ) : null}

        <div className="mt-4 md:hidden">
          <Link
            href={primaryAction.href}
            className={`${cardClass} flex min-h-20 items-center gap-3 p-3 active:scale-[0.99]`}
          >
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-black text-slate-950 ${primaryAction.color}`}
            >
              <primaryAction.icon className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xl font-black text-[#f8fafc]">{primaryAction.title}</span>
              <span className={`block truncate ${textMutedClass}`}>{primaryAction.text}</span>
            </span>
          </Link>

          <details className={`${cardClass} group mt-3 overflow-hidden`}>
            <summary className="flex min-h-14 list-none items-center justify-between gap-3 px-3 py-2 text-base font-black text-[#f8fafc] marker:hidden">
              <span>Mas opciones</span>
              <ChevronDown className="h-5 w-5 shrink-0 text-slate-300 transition-transform group-open:rotate-180" />
            </summary>
            <div className="grid border-t border-black">
              {secondaryActions.map((action) => (
                <Link
                  key={action.title}
                  href={action.href}
                  className="flex min-h-16 items-center gap-3 border-b border-black px-3 py-2 last:border-b-0 active:bg-surface-card-hover"
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-black text-slate-950 ${action.color}`}
                  >
                    <action.icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-black text-[#f8fafc]">{action.title}</span>
                    <span className={`block truncate ${textMutedClass}`}>{action.text}</span>
                  </span>
                </Link>
              ))}
            </div>
          </details>
        </div>

        <div className="mt-4 hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-4">
          {actions.map((action) => (
            <BigAction key={action.title} {...action} />
          ))}
        </div>
      </Panel>
    </>
  );
}
