import { AppShell } from "@/components/app-shell";
import { Panel, StatCard } from "@/components/ui-blocks";

const clients = [
  ["Maria Lopez", "(305) 555-0182", "Mexico", "3 envios"],
  ["Jose Ramirez", "(786) 555-0120", "Guatemala", "1 envio"],
  ["Ana Perez", "(954) 555-0177", "Colombia", "5 envios"],
  ["Carlos Diaz", "(407) 555-0144", "Honduras", "2 envios"],
];

export default function ClientesPage() {
  return (
    <AppShell active="Clientes" title="Clientes" action="+ Nuevo cliente">
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Clientes" value="148" tone="text-violet-700" />
        <StatCard label="Nuevos hoy" value="6" tone="text-emerald-700" />
        <StatCard label="Sin telefono" value="2" tone="text-rose-700" />
      </div>

      <Panel title="Libreta de clientes">
        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            className="h-14 rounded-lg border border-slate-200 px-4 text-lg font-bold outline-none focus:border-violet-500"
            placeholder="Buscar por nombre o telefono"
          />
          <button className="h-14 rounded-lg bg-violet-600 px-6 text-lg font-black text-white">
            Buscar
          </button>
        </div>

        <div className="grid gap-3">
          {clients.map(([name, phone, country, count]) => (
            <button
              key={phone}
              className="grid gap-3 rounded-lg border border-slate-200 p-4 text-left sm:grid-cols-[1fr_1fr_1fr_auto]"
            >
              <div>
                <p className="text-xl font-black">{name}</p>
                <p className="font-bold text-slate-500">{phone}</p>
              </div>
              <p className="text-lg font-black">{country}</p>
              <p className="text-lg font-bold text-slate-500">{count}</p>
              <span className="rounded-lg bg-slate-100 px-4 py-2 text-center font-black">
                Ver
              </span>
            </button>
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}
