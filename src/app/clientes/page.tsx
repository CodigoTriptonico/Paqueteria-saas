import { AppShell } from "@/components/app-shell";
import { Panel, StatCard } from "@/components/ui-blocks";

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
  {
    name: "Carlos Diaz",
    phone: "(407) 555-0144",
    recipients: ["Pedro Diaz - Mexico"],
  },
];

export default function ClientesPage() {
  return (
    <AppShell active="Clientes" title="Clientes" action="+ Nuevo remitente">
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Remitentes" value="148" tone="text-violet-700" />
        <StatCard label="Destinatarios" value="326" tone="text-emerald-700" />
        <StatCard label="Sin telefono" value="2" tone="text-rose-700" />
      </div>

      <Panel title="Remitentes y destinatarios">
        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            className="h-14 rounded-lg border border-slate-200 px-4 text-lg font-bold outline-none focus:border-violet-500 dark:border-slate-700"
            placeholder="Buscar remitente o telefono"
          />
          <button className="h-14 rounded-lg bg-violet-600 px-6 text-lg font-black text-white">
            Buscar
          </button>
        </div>

        <div className="grid gap-3">
          {senders.map((sender) => (
            <div
              key={sender.phone}
              className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm dark:border-slate-800 dark:bg-slate-950 xl:grid-cols-[0.8fr_1.2fr_auto]"
            >
              <div>
                <p className="text-xl font-black">{sender.name}</p>
                <p className="font-bold text-slate-500 dark:text-slate-400">
                  {sender.phone}
                </p>
              </div>

              <div className="grid gap-2">
                {sender.recipients.map((recipient) => (
                  <div
                    key={recipient}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-bold dark:border-slate-800 dark:bg-slate-900"
                  >
                    {recipient}
                  </div>
                ))}
              </div>

              <button className="h-12 rounded-lg bg-slate-100 px-4 font-black dark:bg-slate-800">
                + Destinatario
              </button>
            </div>
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}
