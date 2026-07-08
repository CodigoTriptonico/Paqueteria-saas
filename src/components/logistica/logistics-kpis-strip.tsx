"use client";

import { CheckCircle2, Route, TriangleAlert, Truck } from "lucide-react";
import { computeLogisticsKpis } from "@/lib/logistics-kpis";
import type { LogisticsRouteRow } from "@/lib/logistics-routing";
import type { LogisticsTaskStatus } from "@/app/actions/shipments";

type LogisticsKpisStripProps = {
  routes: ReadonlyArray<LogisticsRouteRow>;
  tasks: ReadonlyArray<{ status: LogisticsTaskStatus }>;
};

function formatFailureRate(rate: number) {
  if (!Number.isFinite(rate) || rate <= 0) {
    return "0%";
  }

  return `${Math.round(rate * 100)}%`;
}

export function LogisticsKpisStrip({ routes, tasks }: LogisticsKpisStripProps) {
  const kpis = computeLogisticsKpis({ routes, tasks });

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <div className="flex items-center gap-2 rounded-lg border border-black bg-surface-inset px-3 py-2">
        <Route className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase text-slate-500">Rutas activas</p>
          <p className="text-lg font-black tabular-nums text-[#f8fafc]">{kpis.plannedRoutes}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-black bg-surface-inset px-3 py-2">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase text-slate-500">Rutas cerradas</p>
          <p className="text-lg font-black tabular-nums text-[#f8fafc]">{kpis.completedRoutes}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-black bg-surface-inset px-3 py-2">
        <Truck className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase text-slate-500">Tareas abiertas</p>
          <p className="text-lg font-black tabular-nums text-[#f8fafc]">{kpis.openTasks}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-black bg-surface-inset px-3 py-2">
        <TriangleAlert className="h-4 w-4 shrink-0 text-amber-300" aria-hidden />
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase text-slate-500">Fallas</p>
          <p className="text-lg font-black tabular-nums text-[#f8fafc]">
            {kpis.failedTasks}
            <span className="ml-1 text-xs font-black text-slate-500">
              ({formatFailureRate(kpis.failureRate)})
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
