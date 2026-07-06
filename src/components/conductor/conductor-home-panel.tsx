import { Boxes, ListTodo } from "lucide-react";
import { BigAction, labelMutedClass, Panel, StatCard, textMutedClass } from "@/components/ui-blocks";
import type { ConductorTaskSummary } from "@/lib/conductor-dashboard";

type ConductorHomePanelProps = {
  driverLabel: string;
  summary: ConductorTaskSummary;
};

export function ConductorHomePanel({ driverLabel, summary }: ConductorHomePanelProps) {
  const hasWork = summary.totalTasks > 0;

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

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Cajas por dejar"
          value={String(summary.deliverCount)}
          tone="text-emerald-300"
        />
        <StatCard
          label="Cajas por recoger"
          value={String(summary.pickupCount)}
          tone="text-amber-300"
        />
        <StatCard
          label="Domicilios"
          value={String(summary.addressCount)}
          tone="text-sky-300"
        />
      </div>

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
