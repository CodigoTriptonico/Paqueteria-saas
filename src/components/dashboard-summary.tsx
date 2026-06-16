"use client";

import { useEffect, useState } from "react";
import {
  getDashboardSummaryAction,
  type DashboardSummary,
} from "@/app/actions/dashboard";
import { StatCard } from "@/components/ui-blocks";

export function DashboardSummary() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    void getDashboardSummaryAction().then((result) => {
      if (cancelled) {
        return;
      }

      if (result.ok) {
        setSummary(result.data);
        return;
      }

      setError(result.error);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <p className="mb-4 rounded-lg border border-rose-700 bg-rose-950/40 px-4 py-3 text-sm font-bold text-rose-200">
        {error}
      </p>
    );
  }

  if (!summary) {
    return (
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="skeleton-card h-[5.5rem] rounded-lg border border-black bg-surface-card"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Envios pendientes" value={String(summary.pendingShipments)} tone="text-amber-300" />
      <StatCard label="Ventas hoy" value={String(summary.salesToday)} tone="text-emerald-300" />
      <StatCard label="Stock bajo" value={String(summary.lowStockItems)} tone="text-rose-300" />
      <StatCard label="Clientes activos" value={String(summary.activeCustomers)} tone="text-sky-300" />
    </div>
  );
}
