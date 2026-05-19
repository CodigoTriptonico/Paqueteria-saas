import { Plus, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/ui-blocks";

const senders = [
  {
    name: "Maria Lopez",
    phone: "(305) 555-0182",
    recipients: ["Rosa Lopez - Mexico", "Luis Lopez - Mexico", "Ana Lopez - Guatemala"],
  },
  {
    name: "Jose Ramirez",
    phone: "(786) 555-0120",
    recipients: ["Carlos Ramirez - Guatemala", "Marta Ruiz - Honduras"],
  },
  {
    name: "Ana Perez",
    phone: "(954) 555-0177",
    recipients: ["Diana Perez - Colombia", "Luz Gomez - Colombia"],
  },
];

const inputClass =
  "h-14 min-w-0 rounded-lg border border-slate-200 px-4 text-lg font-bold outline-none focus:border-emerald-500 dark:border-slate-700";

export default function VentaPage() {
  return (
    <AppShell
      active="Nueva venta"
      title="Nueva venta"
      kicker="Remitente + venta"
      secondaryAction="Agregar nuevo cliente"
      action="Nueva venta"
    >
      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <section className="grid gap-5">
          <Panel title="Buscar remitente">
            <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-400" />
                <input
                  className={`${inputClass} w-full pl-12`}
                  placeholder="Nombre o telefono"
                />
              </div>
              <button className="flex h-14 items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 text-lg font-black text-white">
                <Plus className="h-6 w-6" />
                Nuevo
              </button>
            </div>

            <div className="grid gap-3">
              {senders.map((sender, index) => (
                <div
                  key={sender.phone}
                  className={`rounded-xl border p-4 ${
                    index === 0
                      ? "border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950"
                      : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xl font-black">{sender.name}</p>
                      <p className="font-bold text-slate-500 dark:text-slate-400">
                        {sender.phone}
                      </p>
                    </div>
                    <span className="rounded-lg bg-white px-3 py-2 text-sm font-black text-slate-900 dark:bg-slate-900 dark:text-white">
                      {sender.recipients.length} destinos
                    </span>
                  </div>

                  <div className="grid gap-2">
                    {sender.recipients.map((recipient, recipientIndex) => (
                      <button
                        key={recipient}
                        className={`rounded-lg border px-3 py-3 text-left text-base font-black ${
                          index === 0 && recipientIndex === 0
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                        }`}
                      >
                        {recipient}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        <section className="grid gap-5">
          <Panel title="Datos del envio">
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950">
              <p className="text-sm font-black uppercase text-emerald-700 dark:text-emerald-300">
                Seleccionado
              </p>
              <p className="text-2xl font-black">Maria Lopez</p>
              <p className="font-bold text-slate-600 dark:text-slate-300">
                Rosa Lopez - Mexico
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[
                "Caja",
                "Peso",
                "Pais destino",
                "Carrier",
                "Tipo servicio",
                "Entrega/Pickup",
              ].map((label) => (
                <label key={label} className="grid gap-2">
                  <span className="text-lg font-black">{label}</span>
                  <input className={inputClass} placeholder={label} />
                </label>
              ))}
            </div>
          </Panel>

          <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
            <Panel title="Precio">
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["Remitente paga", "$100"],
                  ["Carrier cobra", "$60"],
                  ["Ganancia", "$40"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950"
                  >
                    <p className="font-bold text-emerald-700 dark:text-emerald-300">
                      {label}
                    </p>
                    <p className="text-3xl font-black">{value}</p>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Acciones">
              <div className="grid gap-3">
                <button className="h-14 rounded-lg bg-emerald-500 text-lg font-black text-slate-950">
                  Cobrar
                </button>
                <button className="h-14 rounded-lg bg-slate-950 text-lg font-black text-white dark:bg-slate-100 dark:text-slate-950">
                  Imprimir recibo
                </button>
                <button className="h-14 rounded-lg border border-slate-200 text-lg font-black dark:border-slate-700">
                  Guardar pendiente
                </button>
              </div>
            </Panel>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
