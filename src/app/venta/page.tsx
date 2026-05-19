import { PackagePlus, Printer, Truck, UserPlus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BigAction, Panel } from "@/components/ui-blocks";

const actions = [
  {
    title: "Crear envio",
    text: "Caja llena, precio y pago.",
    icon: PackagePlus,
    color: "bg-emerald-500",
  },
  {
    title: "Vender caja",
    text: "Caja vacia al remitente.",
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
    title: "Nuevo remitente",
    text: "Persona que envia.",
    icon: UserPlus,
    color: "bg-violet-500",
  },
];

export default function VentaPage() {
  return (
    <AppShell
      active="Nueva venta"
      title="Nueva venta"
      kicker="Trabajo rapido"
      action="Cobrar"
    >
      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {actions.map((action) => (
          <BigAction key={action.title} {...action} />
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
        <Panel title="Venta rapida">
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            {["Remitente", "Destinatario", "Pais destino", "Caja"].map(
              (label) => (
                <label key={label} className="grid gap-2">
                  <span className="text-lg font-black">{label}</span>
                  <input
                    className="h-14 min-w-0 rounded-lg border border-slate-200 px-4 text-lg font-bold outline-none focus:border-emerald-500 dark:border-slate-700"
                    placeholder={label}
                  />
                </label>
              ),
            )}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {["Peso", "Carrier", "Tipo de servicio"].map((label) => (
              <label key={label} className="grid gap-2">
                <span className="text-lg font-black">{label}</span>
                <input
                  className="h-14 min-w-0 rounded-lg border border-slate-200 px-4 text-lg font-bold outline-none focus:border-emerald-500 dark:border-slate-700"
                  placeholder={label}
                />
              </label>
            ))}
          </div>

          <div className="mt-4 grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950 sm:grid-cols-3">
            <div>
              <p className="font-bold text-emerald-700 dark:text-emerald-300">
                Remitente paga
              </p>
              <p className="text-3xl font-black">$100</p>
            </div>
            <div>
              <p className="font-bold text-emerald-700 dark:text-emerald-300">
                Carrier cobra
              </p>
              <p className="text-3xl font-black">$60</p>
            </div>
            <div>
              <p className="font-bold text-emerald-700 dark:text-emerald-300">
                Ganancia
              </p>
              <p className="text-3xl font-black">$40</p>
            </div>
          </div>
        </Panel>

        <Panel title="Resumen">
          <div className="grid gap-3">
            {[
              ["Remitente", "Maria Lopez"],
              ["Destinatario", "Rosa Lopez - Mexico"],
              ["Caja", "30 x 30 x 30"],
              ["Tiempo", "10-15 dias"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
              >
                <p className="font-bold text-slate-500 dark:text-slate-400">
                  {label}
                </p>
                <p className="text-xl font-black">{value}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
