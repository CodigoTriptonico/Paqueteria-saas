import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/ui-blocks";
import { ThemeToggle } from "@/components/theme-toggle";

const prices = [
  ["Mexico", "30 x 30 x 30", "FedEx", "$100", "$60", "$40", "10-15 dias"],
  ["Guatemala", "30 x 30 x 30", "MGS", "$115", "$73", "$42", "12-18 dias"],
  ["Mexico", "20 x 20 x 20", "Paquete Express", "$85", "$54", "$31", "8-12 dias"],
  ["Colombia", "16 x 16 x 16", "Estafeta", "$62", "$40", "$22", "8-12 dias"],
];

export default function ConfiguracionPage() {
  return (
    <AppShell
      active="Configuracion"
      title="Configuracion"
      action="+ Nueva regla"
    >
      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="grid gap-5">
          <Panel title="Empresa">
            <div className="grid gap-3">
              {["Nombre empresa", "Telefono", "Direccion", "Moneda"].map(
                (label) => (
                  <label key={label} className="grid gap-2">
                    <span className="text-lg font-black">{label}</span>
                    <input
                      className="h-14 rounded-lg border border-slate-200 px-4 text-lg font-bold outline-none focus:border-slate-950 dark:border-slate-700 dark:focus:border-emerald-500"
                      placeholder={label}
                    />
                  </label>
                ),
              )}
            </div>
          </Panel>

          <Panel title="Apariencia">
            <ThemeToggle />
          </Panel>
        </div>

        <Panel title="Precios por pais y medida">
          <div className="grid gap-3">
            {prices.map(([country, size, carrier, client, cost, profit, time]) => (
              <div key={country + size + carrier} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-2xl font-black">
                      {country} - {size}
                    </p>
                    <p className="font-bold text-slate-500 dark:text-slate-400">
                      {carrier} - {time}
                    </p>
                  </div>
                  <button className="rounded-lg bg-slate-950 px-5 py-3 font-black text-white dark:bg-emerald-500 dark:text-slate-950">
                    Editar
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                    <p className="font-bold text-slate-500 dark:text-slate-400">Cliente paga</p>
                    <p className="text-2xl font-black">{client}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                    <p className="font-bold text-slate-500 dark:text-slate-400">Te cobran</p>
                    <p className="text-2xl font-black">{cost}</p>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-100 p-3 dark:border-emerald-800 dark:bg-emerald-950">
                    <p className="font-bold text-emerald-700 dark:text-emerald-300">Ganancia</p>
                    <p className="text-2xl font-black text-emerald-800 dark:text-emerald-200">
                      {profit}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
