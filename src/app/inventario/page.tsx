import { AppShell } from "@/components/app-shell";
import { Panel, StatCard } from "@/components/ui-blocks";

const boxes = [
  ["Chica", "42", "6", "$8"],
  ["Mediana", "31", "9", "$12"],
  ["Grande", "18", "8", "$16"],
  ["Jumbo", "7", "3", "$22"],
];

export default function InventarioPage() {
  return (
    <AppShell active="Inventario" title="Inventario" action="+ Agregar cajas">
      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <StatCard label="En stock" value="98" tone="text-emerald-700" />
        <StatCard label="Entregadas" value="26" tone="text-sky-700" />
        <StatCard label="Pendientes" value="23" tone="text-amber-700" />
        <StatCard label="Bajo stock" value="1" tone="text-rose-700" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <Panel title="Cajas vacias">
          <div className="grid gap-3">
            {boxes.map(([box, stock, pending, price]) => (
              <div
                key={box}
                className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-[1fr_auto_auto_auto]"
              >
                <div>
                  <p className="text-2xl font-black">Caja {box}</p>
                  <p className="font-bold text-slate-500 dark:text-slate-400">Precio {price}</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-slate-500 dark:text-slate-400">Stock</p>
                  <p className="text-3xl font-black">{stock}</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-slate-500 dark:text-slate-400">Pendientes</p>
                  <p className="text-3xl font-black text-amber-700">
                    {pending}
                  </p>
                </div>
                <button className="rounded-lg bg-slate-950 px-5 py-3 font-black text-white dark:bg-emerald-500 dark:text-slate-950">
                  Mover
                </button>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Movimientos">
          <div className="grid gap-3">
            {[
              ["Entregada", "Caja grande", "Maria Lopez"],
              ["Regreso llena", "Caja mediana", "Ana Perez"],
              ["Agregado stock", "10 cajas chicas", "Empleado"],
            ].map(([type, box, person]) => (
              <div key={type + box} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <p className="text-xl font-black">{type}</p>
                <p className="font-bold text-slate-500 dark:text-slate-400">
                  {box} - {person}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
