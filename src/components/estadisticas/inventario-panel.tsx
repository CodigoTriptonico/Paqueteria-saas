"use client";

import { Panel, StatCard, textMutedClass } from "@/components/ui-blocks";
import type { InventarioStatsSnapshot } from "@/lib/estadisticas/inventario-summary";

export function EstadisticasInventarioPanel({
  snapshot,
}: {
  snapshot?: InventarioStatsSnapshot;
}) {
  if (!snapshot) {
    return (
      <Panel title="Inventario" hideHeader>
        <p className={textMutedClass}>Cargando estadísticas de inventario...</p>
      </Panel>
    );
  }

  return (
    <Panel title="Inventario" hideHeader clipContent={false} contentClassName="p-0">
      <div className="space-y-4 p-4 sm:p-5">
        <p className={textMutedClass}>
          Vista operativa del inventario. Últimos 7 días en movimientos.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Filas con stock"
            value={String(snapshot.trackedItems)}
            tone="text-[#f8fafc]"
          />
          <StatCard
            label="Stock bajo"
            value={String(snapshot.lowStockItems)}
            tone="text-amber-300"
          />
          <StatCard
            label="Sin stock"
            value={String(snapshot.emptyStockItems)}
            tone="text-rose-300"
          />
          <StatCard
            label="Movimientos 7d"
            value={String(snapshot.movementsLast7Days)}
            tone="text-sky-300"
          />
          <StatCard
            label="Asignaciones abiertas"
            value={String(snapshot.openAssignments)}
            tone="text-emerald-300"
          />
        </div>
      </div>
    </Panel>
  );
}
