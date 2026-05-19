import { AppShell } from "@/components/app-shell";
import { Panel, StatCard } from "@/components/ui-blocks";

const shipments = [
  ["#1008", "Maria Lopez", "Mexico", "FedEx", "$100", "$40", "En oficina"],
  ["#1007", "Jose Ramirez", "Guatemala", "MGS", "$85", "$31", "Pickup"],
  ["#1006", "Ana Perez", "Colombia", "Estafeta", "$62", "$22", "Enviado"],
  ["#1005", "Carlos Diaz", "Honduras", "Paquete Express", "$94", "$35", "Entregado"],
];

export default function EnviosPage() {
  return (
    <AppShell active="Envios" title="Gestion de envios" action="+ Nuevo envio">
      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <StatCard label="Hoy" value="14" tone="text-emerald-700" />
        <StatCard label="En transito" value="38" tone="text-sky-700" />
        <StatCard label="Pendientes" value="11" tone="text-amber-700" />
        <StatCard label="Ganancia" value="$430" tone="text-blue-700" />
      </div>

      <Panel title="Historial">
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          {["Buscar cliente", "Fecha", "Pais", "Estado"].map((item) => (
            <input
              key={item}
              className="h-12 rounded-lg border border-slate-200 px-4 font-bold outline-none focus:border-sky-500"
              placeholder={item}
            />
          ))}
        </div>

        <div className="grid gap-3">
          {shipments.map(([code, name, country, carrier, paid, profit, status]) => (
            <div
              key={code}
              className="grid gap-3 rounded-lg border border-slate-200 p-4 lg:grid-cols-[auto_1fr_1fr_1fr_auto_auto]"
            >
              <p className="text-xl font-black">{code}</p>
              <div>
                <p className="text-lg font-black">{name}</p>
                <p className="font-bold text-slate-500">{country}</p>
              </div>
              <p className="font-black">{carrier}</p>
              <p className="font-bold text-slate-500">{status}</p>
              <p className="text-xl font-black">{paid}</p>
              <p className="rounded-lg bg-emerald-50 px-4 py-2 text-center text-xl font-black text-emerald-800">
                {profit}
              </p>
            </div>
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}
