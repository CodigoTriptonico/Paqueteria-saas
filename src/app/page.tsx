import { PackagePlus, Printer, Truck, UserPlus } from "lucide-react";
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
    title: "Crear envio",
    text: "Caja llena, precio y pago.",
    icon: PackagePlus,
    color: "bg-emerald-500",
  },
  {
    title: "Vender caja",
    text: "Caja vacia al cliente.",
    icon: Printer,
    color: "bg-sky-500",
  },
  {
    title: "Recoger caja",
    text: "Pickup a domicilio.",
    icon: Truck,
    color: "bg-amber-500",
  },
  {
    title: "Nuevo cliente",
    text: "Nombre, telefono y direccion.",
    icon: UserPlus,
    color: "bg-violet-500",
  },
];

export default function Home() {
  return (
    <AppShell
      active="Nueva venta"
      title="Nueva venta"
      kicker="Hoy"
      action="+ Crear venta"
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

      <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <Panel title="Venta rapida">
          <div className="grid gap-3 md:grid-cols-2">
            {["Cliente", "Pais destino", "Caja", "Peso"].map((label) => (
              <label key={label} className="grid gap-2">
                <span className="text-lg font-black">{label}</span>
                <input
                  className="h-14 rounded-lg border border-slate-200 px-4 text-lg font-bold outline-none focus:border-emerald-500"
                  placeholder={label}
                />
              </label>
            ))}
          </div>
          <div className="mt-4 grid gap-3 rounded-lg bg-emerald-50 p-4 sm:grid-cols-3">
            <div>
              <p className="font-bold text-emerald-700">Cliente paga</p>
              <p className="text-3xl font-black">$100</p>
            </div>
            <div>
              <p className="font-bold text-emerald-700">Carrier cobra</p>
              <p className="text-3xl font-black">$60</p>
            </div>
            <div>
              <p className="font-bold text-emerald-700">Ganancia</p>
              <p className="text-3xl font-black">$40</p>
            </div>
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
                className="flex items-center justify-between rounded-lg bg-slate-50 p-4"
              >
                <div>
                  <p className="text-xl font-black">{type}</p>
                  <p className="font-bold text-slate-500">{name}</p>
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
