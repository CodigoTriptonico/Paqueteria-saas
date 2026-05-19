"use client";

import { ArrowLeft, Plus } from "lucide-react";
import { useState } from "react";
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
  ["30 x 30 x 30", "18", "$100", "$60", "FedEx", "10-15 dias"],
  ["20 x 20 x 20", "31", "$85", "$54", "Paquete Express", "8-12 dias"],
  ["16 x 16 x 16", "42", "$62", "$40", "Estafeta", "8-12 dias"],
  ["14 x 14 x 14", "7", "$48", "$31", "MGS", "7-10 dias"],
];

const inputClass =
  "h-12 rounded-lg border border-slate-200 px-3 text-base font-bold outline-none focus:border-emerald-500 dark:border-slate-700";

export default function ConfiguracionPage() {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  return (
    <AppShell
      active="Configuracion"
      title="Configuracion"
      action={selectedCountry ? "Guardar cambios" : undefined}
    >
      {!selectedCountry ? (
        <div className="grid gap-5 xl:grid-cols-[1fr_0.45fr]">
          <Panel title="Paises">
            <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                className="h-14 rounded-lg border border-slate-200 px-4 text-lg font-bold outline-none focus:border-emerald-500 dark:border-slate-700"
                placeholder="Nombre del pais"
              />
              <button className="flex h-14 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-6 text-lg font-black text-slate-950">
                <Plus className="h-6 w-6" />
                Crear pais
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {countries.map(([country, detail]) => (
                <button
                  key={country}
                  onClick={() => setSelectedCountry(country)}
                  className="min-h-40 rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm hover:border-emerald-400 hover:bg-emerald-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-emerald-700 dark:hover:bg-emerald-950"
                >
                  <p className="text-3xl font-black">{country}</p>
                  <p className="mt-2 text-lg font-bold text-slate-500 dark:text-slate-400">
                    {detail}
                  </p>
                  <span className="mt-6 inline-flex rounded-lg bg-slate-950 px-4 py-3 font-black text-white dark:bg-emerald-500 dark:text-slate-950">
                    Configurar
                  </span>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Apariencia">
            <ThemeToggle />
          </Panel>
        </div>
      ) : (
        <Panel title={`${selectedCountry} - configurar cajas`}>
          <button
            onClick={() => setSelectedCountry(null)}
            className="mb-5 flex h-12 items-center gap-2 rounded-lg border border-slate-200 px-4 font-black dark:border-slate-700"
          >
            <ArrowLeft className="h-5 w-5" />
            Volver a paises
          </button>

          <div className="grid gap-4">
            {inventoryBoxes.map(([size, stock, customerPrice, carrierCost, carrier, time]) => (
              <div
                key={size}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-2xl font-black">Caja {size}</p>
                    <p className="font-bold text-slate-500 dark:text-slate-400">
                      Stock global: {stock}
                    </p>
                  </div>
                  <button className="h-11 rounded-lg bg-slate-950 px-5 font-black text-white dark:bg-slate-100 dark:text-slate-950">
                    Activa
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <label className="grid gap-2">
                    <span className="font-black">Cliente paga</span>
                    <input className={inputClass} defaultValue={customerPrice} />
                  </label>
                  <label className="grid gap-2">
                    <span className="font-black">Distribuidora cobra</span>
                    <input className={inputClass} defaultValue={carrierCost} />
                  </label>
                  <label className="grid gap-2">
                    <span className="font-black">Carrier</span>
                    <input className={inputClass} defaultValue={carrier} />
                  </label>
                  <label className="grid gap-2">
                    <span className="font-black">Tiempo</span>
                    <input className={inputClass} defaultValue={time} />
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
      )}
    </AppShell>
  );
}
