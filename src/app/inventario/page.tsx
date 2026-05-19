import { AppShell } from "@/components/app-shell";
import { Panel, StatCard } from "@/components/ui-blocks";

const boxes = [
  ["30 x 30 x 30", "18", "8", "Grande"],
  ["20 x 20 x 20", "31", "9", "Mediana"],
  ["16 x 16 x 16", "42", "6", "Chica"],
  ["14 x 14 x 14", "7", "3", "Mini"],
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
        <Panel title="Inventario global de cajas">
          <div className="grid gap-3">
            {boxes.map(([size, stock, pending, name]) => (
              <div
                key={size}
                className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-[1fr_auto_auto_auto]"
              >
                <div>
                  <p className="text-2xl font-black">Caja {size}</p>
                  <p className="font-bold text-slate-500 dark:text-slate-400">
                    {name} - pulgadas
                  </p>
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
              ["Entregada", "30 x 30 x 30", "Maria Lopez"],
              ["Regreso llena", "20 x 20 x 20", "Ana Perez"],
              ["Agregado stock", "10 cajas 16 x 16 x 16", "Empleado"],
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
