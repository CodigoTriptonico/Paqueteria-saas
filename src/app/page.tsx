import { ClipboardList, PackagePlus, Truck, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BigAction, Panel, StatCard } from "@/components/ui-blocks";

const stats = [
  { label: "Ventas hoy", value: "$1,240", tone: "text-emerald-700" },
  { label: "Ganancia", value: "$430", tone: "text-blue-700" },
  { label: "Pickups", value: "8", tone: "text-amber-700" },
  { label: "Cajas pendientes", value: "23", tone: "text-rose-700" },
];

const actions = [
  {
    title: "Nueva venta",
    text: "Crear envio o vender caja.",
    icon: PackagePlus,
    color: "bg-emerald-500",
  },
  {
    title: "Clientes",
    text: "Remitentes y destinatarios.",
    icon: Users,
    color: "bg-sky-500",
  },
  {
    title: "Pickups",
    text: "Recoger o entregar cajas.",
    icon: Truck,
    color: "bg-amber-500",
  },
  {
    title: "Envios",
    text: "Historial y estados.",
    icon: ClipboardList,
    color: "bg-violet-500",
  },
];

export default function Home() {
  return (
    <AppShell
      active="Inicio"
      title="Inicio"
      kicker="Resumen"
      action="+ Nueva venta"
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </div>

      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {actions.map((action) => (
          <BigAction key={action.title} {...action} />
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Panel title="Actividad reciente">
          <div className="grid gap-3">
            {[
              ["Envio creado", "Maria Lopez a Mexico", "$100"],
              ["Caja entregada", "Jose Ramirez - 20 x 20 x 20", "$12"],
              ["Pago recibido", "Ana Perez", "$62"],
            ].map(([type, text, amount]) => (
              <div
                key={type + text}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
              >
                <div>
                  <p className="text-xl font-black">{type}</p>
                  <p className="font-bold text-slate-500 dark:text-slate-400">
                    {text}
                  </p>
                </div>
                <p className="text-xl font-black">{amount}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Pendientes hoy">
          <div className="grid gap-3">
            {[
              ["Recoger", "Maria Lopez", "5:00 PM"],
              ["Entregar caja", "Jose Ramirez", "6:30 PM"],
              ["Cobrar", "Ana Perez", "$62"],
            ].map(([type, name, extra]) => (
              <div
                key={name}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
              >
                <div>
                  <p className="text-xl font-black">{type}</p>
                  <p className="font-bold text-slate-500 dark:text-slate-400">{name}</p>
                </div>
                <p className="text-xl font-black">{extra}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
