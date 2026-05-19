import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Panel } from "@/components/ui-blocks";

const countries = [
  ["Mexico", "4 cajas configuradas"],
  ["Guatemala", "3 cajas configuradas"],
  ["Colombia", "2 cajas configuradas"],
  ["Honduras", "1 caja configurada"],
];

const inventoryBoxes = [
  {
    size: "30 x 30 x 30",
    stock: "18",
    customerPrice: "$100",
    carrierCost: "$60",
    time: "10-15 dias",
    carrier: "FedEx",
  },
  {
    size: "20 x 20 x 20",
    stock: "31",
    customerPrice: "$85",
    carrierCost: "$54",
    time: "8-12 dias",
    carrier: "Paquete Express",
  },
  {
    size: "16 x 16 x 16",
    stock: "42",
    customerPrice: "$62",
    carrierCost: "$40",
    time: "8-12 dias",
    carrier: "Estafeta",
  },
  {
    size: "14 x 14 x 14",
    stock: "7",
    customerPrice: "$48",
    carrierCost: "$31",
    time: "7-10 dias",
    carrier: "MGS",
  },
];

const inputClass =
  "h-12 rounded-lg border border-slate-200 px-3 text-base font-bold outline-none focus:border-emerald-500 dark:border-slate-700";

export default function ConfiguracionPage() {
  return (
    <AppShell
      active="Configuracion"
      title="Configuracion"
      action="Guardar cambios"
    >
      <div className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
        <section className="grid gap-5">
          <Panel title="Paises">
            <div className="mb-4 grid gap-3">
              <input
                className="h-14 rounded-lg border border-slate-200 px-4 text-lg font-bold outline-none focus:border-emerald-500 dark:border-slate-700"
                placeholder="Nombre del pais"
              />
              <button className="flex h-14 items-center justify-center gap-2 rounded-lg bg-emerald-500 text-lg font-black text-slate-950">
                <Plus className="h-6 w-6" />
                Crear pais
              </button>
            </div>

            <div className="grid gap-3">
              {countries.map(([country, detail], index) => (
                <button
                  key={country}
                  className={`rounded-xl border p-4 text-left ${
                    index === 0
                      ? "border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950"
                      : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
                  }`}
                >
                  <p className="text-2xl font-black">{country}</p>
                  <p className="font-bold text-slate-500 dark:text-slate-400">
                    {detail}
                  </p>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Apariencia">
            <ThemeToggle />
          </Panel>
        </section>

        <Panel title="Mexico - precios por caja">
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <p className="text-sm font-black uppercase text-slate-500 dark:text-slate-400">
              Usa las cajas del inventario global
            </p>
            <p className="text-xl font-black">
              Cada pais tiene precio, costo y tiempo propio.
            </p>
          </div>

          <div className="grid gap-4">
            {inventoryBoxes.map((box) => (
              <div
                key={box.size}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-2xl font-black">Caja {box.size}</p>
                    <p className="font-bold text-slate-500 dark:text-slate-400">
                      Stock global: {box.stock}
                    </p>
                  </div>
                  <button className="h-11 rounded-lg bg-slate-950 px-5 font-black text-white dark:bg-slate-100 dark:text-slate-950">
                    Activa
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <label className="grid gap-2">
                    <span className="font-black">Cliente paga</span>
                    <input className={inputClass} defaultValue={box.customerPrice} />
                  </label>
                  <label className="grid gap-2">
                    <span className="font-black">Distribuidora cobra</span>
                    <input className={inputClass} defaultValue={box.carrierCost} />
                  </label>
                  <label className="grid gap-2">
                    <span className="font-black">Carrier</span>
                    <input className={inputClass} defaultValue={box.carrier} />
                  </label>
                  <label className="grid gap-2">
                    <span className="font-black">Tiempo</span>
                    <input className={inputClass} defaultValue={box.time} />
                  </label>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-100 p-3 dark:border-emerald-800 dark:bg-emerald-950">
                    <p className="font-bold text-emerald-700 dark:text-emerald-300">
                      Ganancia
                    </p>
                    <p className="text-2xl font-black text-emerald-800 dark:text-emerald-200">
                      $40
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
