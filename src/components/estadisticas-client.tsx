"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";
import { EstadisticasVentasPanel } from "@/components/estadisticas/ventas-panel";
import { useContextNav } from "@/hooks/use-context-nav";
import type { SellerMetricsReport } from "@/lib/seller-metrics/summary";

export function EstadisticasClient({
  initialVentasReport,
  initialVentasError,
}: {
  initialVentasReport?: SellerMetricsReport;
  initialVentasError?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sellerId = searchParams.get("seller");
  const sellerName = searchParams.get("sellerName");

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

  return (
    <EstadisticasVentasPanel
      initialReport={initialVentasReport}
      initialError={initialVentasError}
    />
  );
}
