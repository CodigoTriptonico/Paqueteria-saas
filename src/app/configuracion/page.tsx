import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/ui-blocks";

const prices = [
  ["Mexico", "Caja grande", "FedEx", "$100", "$60", "$40", "10-15 dias"],
  ["Guatemala", "Caja mediana", "MGS", "$85", "$54", "$31", "12-18 dias"],
  ["Colombia", "Caja chica", "Estafeta", "$62", "$40", "$22", "8-12 dias"],
];

export default function ConfiguracionPage() {
  return (
    <AppShell
      active="Configuracion"
      title="Configuracion"
      action="+ Nueva regla"
    >
      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Empresa">
          <div className="grid gap-3">
            {["Nombre empresa", "Telefono", "Direccion", "Moneda"].map(
              (label) => (
                <label key={label} className="grid gap-2">
                  <span className="text-lg font-black">{label}</span>
                  <input
                    className="h-14 rounded-lg border border-slate-200 px-4 text-lg font-bold outline-none focus:border-slate-950"
                    placeholder={label}
                  />
                </label>
              ),
            )}
          </div>
        </Panel>

        <Panel title="Precios por pais y caja">
          <div className="grid gap-3">
            {prices.map(([country, box, carrier, client, cost, profit, time]) => (
              <div key={country + box} className="rounded-lg bg-slate-50 p-4">
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-2xl font-black">
                      {country} - {box}
                    </p>
                    <p className="font-bold text-slate-500">
                      {carrier} - {time}
                    </p>
                  </div>
                  <button className="rounded-lg bg-slate-950 px-5 py-3 font-black text-white">
                    Editar
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-white p-3">
                    <p className="font-bold text-slate-500">Cliente paga</p>
                    <p className="text-2xl font-black">{client}</p>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <p className="font-bold text-slate-500">Te cobran</p>
                    <p className="text-2xl font-black">{cost}</p>
                  </div>
                  <div className="rounded-lg bg-emerald-100 p-3">
                    <p className="font-bold text-emerald-700">Ganancia</p>
                    <p className="text-2xl font-black text-emerald-800">
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
