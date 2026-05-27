import { ClipboardList, PackagePlus, Truck, Users } from "lucide-react";
import { BigAction, labelMutedClass, Panel, StatCard, textMutedClass } from "@/components/ui-blocks";

const stats = [
  { label: "Ventas hoy", value: "$1,240", tone: "text-[#f8fafc]" },
  { label: "Ganancia", value: "$430", tone: "text-[#f8fafc]" },
  { label: "Pickups", value: "8", tone: "text-[#f8fafc]" },
  { label: "Cajas pendientes", value: "23", tone: "text-rose-400" },
];

const actions = [
  {
    title: "Nueva venta",
    text: "Crear envio o vender caja.",
    icon: PackagePlus,
    color: "bg-emerald-400",
    href: "/venta",
  },
  {
    title: "Clientes",
    text: "Remitentes y destinatarios.",
    icon: Users,
    color: "bg-emerald-400",
    href: "/venta",
  },
  {
    title: "Pickups",
    text: "Recoger o entregar cajas.",
    icon: Truck,
    color: "bg-emerald-400",
    href: "/envios",
  },
  {
    title: "Envios",
    text: "Historial y estados.",
    icon: ClipboardList,
    color: "bg-emerald-400",
    href: "/envios",
  },
];

function ActivityRow({
  title,
  text,
  amount,
}: {
  title: string;
  text: string;
  amount: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-black bg-surface-card shadow-[0_6px_20px_rgba(0,0,0,0.18)]">
      <div className="border-b border-black bg-surface-card-header px-3 py-2">
        <p className="text-base font-black text-[#f8fafc]">{title}</p>
      </div>
      <div className="flex items-center justify-between gap-3 px-3 py-3">
        <p className={textMutedClass}>{text}</p>
        <p className="text-lg font-black text-[#f8fafc]">{amount}</p>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <Panel title="Inicio" hideHeader>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className={labelMutedClass}>Resumen</p>
            <h3 className="truncate text-2xl font-black text-[#f8fafc]">Inicio</h3>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((item) => (
            <StatCard key={item.label} {...item} />
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {actions.map((action) => (
            <BigAction key={action.title} {...action} />
          ))}
        </div>
      </Panel>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Panel title="Actividad reciente">
          <div className="grid gap-3">
            {[
              ["Envio creado", "Maria Lopez a Mexico", "$100"],
              ["Caja entregada", "Jose Ramirez - 20 x 20 x 20", "$12"],
              ["Pago recibido", "Ana Perez", "$62"],
            ].map(([type, text, amount]) => (
              <ActivityRow key={type + text} title={type} text={text} amount={amount} />
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
              <ActivityRow key={name} title={type} text={name} amount={extra} />
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
