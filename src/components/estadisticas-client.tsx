"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { Boxes, History, TrendingUp, type LucideIcon } from "lucide-react";
import { EstadisticasAuditoriaPanel } from "@/components/estadisticas/auditoria-panel";
import { EstadisticasInventarioPanel } from "@/components/estadisticas/inventario-panel";
import { EstadisticasVentasPanel } from "@/components/estadisticas/ventas-panel";
import { iconWellEmerald } from "@/components/ui-blocks";
import { useContextNav } from "@/hooks/use-context-nav";
import type { InventarioStatsSnapshot } from "@/lib/estadisticas/inventario-summary";
import type { SellerMetricsReport } from "@/lib/seller-metrics/summary";

type EstadisticasSection = "menu" | "ventas" | "inventario" | "auditoria";

const sectionCards: {
  id: Exclude<EstadisticasSection, "menu">;
  title: string;
  text: string;
  icon: LucideIcon;
}[] = [
  {
    id: "ventas",
    title: "Ventas",
    text: "Ranking de vendedores, cobrado y desglose por periodo.",
    icon: TrendingUp,
  },
  {
    id: "inventario",
    title: "Inventario",
    text: "Stock bajo, movimientos recientes y asignaciones abiertas.",
    icon: Boxes,
  },
  {
    id: "auditoria",
    title: "Auditoría",
    text: "Tiempos entre hitos, órdenes en envíos y historial por invoice.",
    icon: History,
  },
];

const estadisticasSections: EstadisticasSection[] = ["menu", "ventas", "inventario", "auditoria"];

const navCardClass =
  "group flex min-h-[10.5rem] min-w-0 flex-col rounded-xl border border-black bg-surface-card p-5 text-left shadow-[0_6px_20px_rgba(0,0,0,0.18)] transition hover:border-emerald-700/35 hover:bg-surface-card-hover";

function parseEstadisticasUrl(params: URLSearchParams): EstadisticasSection {
  const view = params.get("view");
  return estadisticasSections.includes(view as EstadisticasSection)
    ? (view as EstadisticasSection)
    : "menu";
}

function EstadisticasNavCard({
  href,
  title,
  text,
  icon: Icon,
}: {
  href: string;
  title: string;
  text: string;
  icon: LucideIcon;
}) {
  return (
    <Link href={href} className={navCardClass}>
      <span className={`h-12 w-12 shrink-0 ${iconWellEmerald}`}>
        <Icon className="h-7 w-7" />
      </span>
      <span className="mt-5 block break-words text-2xl font-black leading-snug text-[#f8fafc]">
        {title}
      </span>
      <span className="mt-2 block flex-1 break-words text-sm font-bold leading-snug text-slate-300 sm:text-base">
        {text}
      </span>
    </Link>
  );
}

const sectionTitles: Record<Exclude<EstadisticasSection, "menu">, string> = {
  ventas: "Ventas",
  inventario: "Inventario",
  auditoria: "Auditoría",
};

export function EstadisticasClient({
  initialVentasReport,
  initialVentasError,
  initialInventarioStats,
}: {
  initialVentasReport?: SellerMetricsReport;
  initialVentasError?: string;
  initialInventarioStats?: InventarioStatsSnapshot;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = useMemo(() => parseEstadisticasUrl(searchParams), [searchParams]);
  const sellerId = searchParams.get("seller");
  const sellerName = searchParams.get("sellerName");
  const shipmentId = searchParams.get("shipment");

  const openSection = useCallback(
    (nextSection: EstadisticasSection) => {
      if (nextSection === "menu") {
        router.replace("/estadisticas", { scroll: false });
        return;
      }

      router.replace(`/estadisticas?view=${nextSection}`, { scroll: false });
    },
    [router],
  );

  const goBack = useCallback(() => {
    if (section === "ventas" && sellerId) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("seller");
      params.delete("sellerName");
      router.replace(`/estadisticas?${params.toString()}`, { scroll: false });
      return;
    }

    openSection("menu");
  }, [openSection, router, searchParams, section, sellerId]);

  const contextTitle =
    section === "ventas" && sellerId && sellerName
      ? sellerName
      : section === "menu"
        ? undefined
        : sectionTitles[section];

  useContextNav({
    title: contextTitle ?? "Estadísticas",
    onBack: goBack,
    enabled: Boolean(contextTitle),
  });

  if (section === "menu") {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
        {sectionCards.map((item) => (
          <EstadisticasNavCard
            key={item.id}
            href={`/estadisticas?view=${item.id}`}
            title={item.title}
            text={item.text}
            icon={item.icon}
          />
        ))}
      </div>
    );
  }

  if (section === "ventas") {
    return (
      <EstadisticasVentasPanel
        initialReport={initialVentasReport}
        initialError={initialVentasError}
      />
    );
  }

  if (section === "auditoria") {
    return <EstadisticasAuditoriaPanel selectedShipmentId={shipmentId} />;
  }

  return <EstadisticasInventarioPanel snapshot={initialInventarioStats} />;
}
