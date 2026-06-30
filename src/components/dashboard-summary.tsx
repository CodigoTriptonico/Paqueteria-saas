"use client";

import { StatCard } from "@/components/ui-blocks";
import type { DashboardSummary } from "@/lib/dashboard/summary";

export function DashboardSummary({
  initialSummary,
}: {
  initialSummary?: DashboardSummary | null;
}) {
  if (!initialSummary) {
    return null;
  }

  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Envios pendientes" value={String(initialSummary.pendingShipments)} tone="text-amber-300" />
      <StatCard label="Ventas hoy" value={String(initialSummary.salesToday)} tone="text-emerald-300" />
      <StatCard label="Stock bajo" value={String(initialSummary.lowStockItems)} tone="text-rose-300" />
      <StatCard label="Clientes activos" value={String(initialSummary.activeCustomers)} tone="text-sky-300" />
    </div>
  );
}
