"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EstadisticasVentasPanel } from "@/components/estadisticas/ventas-panel";
import { DistribuidoresPanel } from "@/components/estadisticas/distribuidores-panel";
import { useContextNav } from "@/hooks/use-context-nav";
import type { SellerMetricsReport } from "@/lib/seller-metrics/summary";
import type { DistributionMetricsReport } from "@/lib/distribution/metrics";

export function EstadisticasClient({
  initialVentasReport,
  initialVentasError,
  initialDistributionReport,
  initialDistributionError,
}: {
  initialVentasReport?: SellerMetricsReport;
  initialVentasError?: string;
  initialDistributionReport?: DistributionMetricsReport;
  initialDistributionError?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sellerId = searchParams.get("seller");
  const sellerName = searchParams.get("sellerName");
  const [tab, setTab] = useState<"vendedores" | "distribuidores">(searchParams.get("tab") === "distribuidores" ? "distribuidores" : "vendedores");

  useEffect(() => {
    if (searchParams.get("seller")) setTab("vendedores");
  }, [searchParams]);

  useEffect(() => {
    const view = searchParams.get("view");

    if (view === "auditoria") {
      const shipment = searchParams.get("shipment");
      router.replace(shipment ? `/auditoria?shipment=${shipment}` : "/auditoria");
      return;
    }

    if (view === "inventario") {
      router.replace("/inventario");
    }
  }, [router, searchParams]);

  const goBack = useCallback(() => {
    if (!sellerId) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("seller");
    params.delete("sellerName");
    const query = params.toString();
    router.replace(query ? `/estadisticas?${query}` : "/estadisticas", { scroll: false });
  }, [router, searchParams, sellerId]);

  const contextTitle = useMemo(
    () => (sellerId && sellerName ? sellerName : undefined),
    [sellerId, sellerName],
  );

  useContextNav({
    title: contextTitle ?? "Estadísticas",
    onBack: goBack,
    enabled: Boolean(contextTitle),
  });

  return <div className="space-y-3"><div className="flex w-fit overflow-hidden rounded-lg border border-black bg-surface-inset"><button onClick={() => setTab("vendedores")} className={`h-10 px-4 text-sm font-black ${tab === "vendedores" ? "bg-emerald-400 text-slate-950" : "text-slate-300 hover:bg-surface-card-hover"}`}>Vendedores</button><button onClick={() => setTab("distribuidores")} className={`h-10 border-l border-black px-4 text-sm font-black ${tab === "distribuidores" ? "bg-emerald-400 text-slate-950" : "text-slate-300 hover:bg-surface-card-hover"}`}>Distribuidores</button></div>{tab === "vendedores" ? <EstadisticasVentasPanel initialReport={initialVentasReport} initialError={initialVentasError} /> : <DistribuidoresPanel initialReport={initialDistributionReport} initialError={initialDistributionError} />}</div>;
}
