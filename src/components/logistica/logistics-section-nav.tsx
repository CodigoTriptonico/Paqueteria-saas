"use client";

import Link from "next/link";
import { ClipboardList, Route, Truck, Users } from "lucide-react";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";

export type LogisticsSection = "tasks" | "routes" | "drivers" | "vehicles";

type LogisticsSectionNavProps = {
  active: LogisticsSection;
  className?: string;
  routesOnClick?: () => void;
  routesHref?: string;
  extraActions?: React.ReactNode;
};

function sectionButtonClass(active: LogisticsSection, section: LogisticsSection) {
  return `${active === section ? primaryButtonClass : secondaryButtonClass} inline-flex h-9 shrink-0 items-center justify-center gap-2 px-2.5 text-xs`;
}

export function LogisticsSectionNav({
  active,
  className = "",
  routesOnClick,
  routesHref = "/logistica?view=rutas",
  extraActions,
}: LogisticsSectionNavProps) {
  return (
    <div className={`flex w-full min-w-0 flex-wrap items-center gap-1.5 sm:w-auto ${className}`.trim()}>
      <Link href="/logistica" className={sectionButtonClass(active, "tasks")}>
        <ClipboardList className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Tareas
      </Link>
      <Link href="/logistica/conductores" className={sectionButtonClass(active, "drivers")}>
        <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Conductores
      </Link>
      <Link href="/logistica/vehiculos" className={sectionButtonClass(active, "vehicles")}>
        <Truck className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Vehiculos
      </Link>
      {active === "routes" && routesOnClick ? (
        <button type="button" className={sectionButtonClass(active, "routes")} onClick={routesOnClick}>
          <Route className="h-4 w-4 shrink-0" aria-hidden />
          Rutas
        </button>
      ) : (
        <Link href={routesHref} className={sectionButtonClass(active, "routes")}>
          <Route className="h-4 w-4 shrink-0" aria-hidden />
          Rutas
        </Link>
      )}
      {extraActions}
    </div>
  );
}
