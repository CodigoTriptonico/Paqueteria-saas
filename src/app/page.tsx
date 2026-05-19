import {
  Boxes,
  ClipboardList,
  CreditCard,
  PackageCheck,
  PackagePlus,
  Settings,
  Truck,
  Users,
} from "lucide-react";

const quickActions = [
  {
    title: "Nueva venta",
    text: "Crear envio, cobrar e imprimir.",
    icon: CreditCard,
    color: "bg-emerald-500",
  },
  {
    title: "Entregar caja",
    text: "Caja vacia para el cliente.",
    icon: PackagePlus,
    color: "bg-sky-500",
  },
  {
    title: "Recoger caja",
    text: "Pickup de caja llena.",
    icon: Truck,
    color: "bg-amber-500",
  },
  {
    title: "Buscar cliente",
    text: "Telefono, direccion, historial.",
    icon: Users,
    color: "bg-violet-500",
  },
];

const stats = [
  { label: "Ventas hoy", value: "$1,240", tone: "text-emerald-700" },
  { label: "Ganancia", value: "$430", tone: "text-blue-700" },
  { label: "Pickups", value: "8", tone: "text-amber-700" },
  { label: "Cajas pendientes", value: "23", tone: "text-rose-700" },
];

const shipments = [
  ["Maria Lopez", "Mexico", "Caja grande", "$100", "$40"],
  ["Jose Ramirez", "Guatemala", "Caja mediana", "$85", "$31"],
  ["Ana Perez", "Colombia", "Caja chica", "$62", "$22"],
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f6f7fb] text-slate-950">
      <div className="mx-auto flex max-w-7xl gap-5 p-5">
        <aside className="hidden w-64 shrink-0 rounded-lg bg-white p-4 shadow-sm lg:block">
          <div className="mb-8 rounded-lg bg-slate-950 p-4 text-white">
            <p className="text-sm text-slate-300">SaaS</p>
            <h1 className="text-2xl font-black">Paquemas</h1>
          </div>

          <nav className="grid gap-2">
            {[
              ["Nueva venta", CreditCard, "bg-emerald-50 text-emerald-800"],
              ["Clientes", Users, ""],
              ["Inventario", Boxes, ""],
              ["Envios", ClipboardList, ""],
              ["Configuracion", Settings, ""],
            ].map(([label, Icon, active]) => (
              <button
                key={label as string}
                className={`flex h-14 items-center gap-3 rounded-lg px-4 text-left text-lg font-bold ${
                  active || "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <Icon className="h-6 w-6" />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="flex-1">
          <header className="mb-5 flex flex-col gap-3 rounded-lg bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase text-slate-500">
                Martes 19 Mayo
              </p>
              <h2 className="text-3xl font-black">Nueva venta</h2>
            </div>
            <button className="h-14 rounded-lg bg-slate-950 px-6 text-lg font-black text-white">
              + Crear envio
            </button>
          </header>

          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((item) => (
              <div key={item.label} className="rounded-lg bg-white p-5 shadow-sm">
                <p className="text-base font-bold text-slate-500">{item.label}</p>
                <p className={`mt-2 text-4xl font-black ${item.tone}`}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {quickActions.map((action) => (
              <button
                key={action.title}
                className="min-h-44 rounded-lg bg-white p-5 text-left shadow-sm transition hover:scale-[1.01]"
              >
                <span
                  className={`mb-5 flex h-16 w-16 items-center justify-center rounded-lg text-white ${action.color}`}
                >
                  <action.icon className="h-9 w-9" />
                </span>
                <span className="block text-2xl font-black">{action.title}</span>
                <span className="mt-2 block text-lg font-semibold text-slate-500">
                  {action.text}
                </span>
              </button>
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-lg bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-2xl font-black">Envios recientes</h3>
                <PackageCheck className="h-7 w-7 text-emerald-600" />
              </div>
              <div className="grid gap-3">
                {shipments.map(([name, country, box, paid, profit]) => (
                  <div
                    key={name}
                    className="grid gap-2 rounded-lg border border-slate-200 p-4 sm:grid-cols-[1fr_1fr_auto]"
                  >
                    <div>
                      <p className="text-xl font-black">{name}</p>
                      <p className="font-bold text-slate-500">{country}</p>
                    </div>
                    <div>
                      <p className="font-bold">{box}</p>
                      <p className="font-bold text-slate-500">Pagado {paid}</p>
                    </div>
                    <div className="rounded-lg bg-emerald-50 px-4 py-2 text-center">
                      <p className="text-sm font-bold text-emerald-700">
                        Ganancia
                      </p>
                      <p className="text-2xl font-black text-emerald-800">
                        {profit}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-2xl font-black">Inventario cajas</h3>
              {[
                ["Chica", "42", "6"],
                ["Mediana", "31", "9"],
                ["Grande", "18", "8"],
                ["Jumbo", "7", "3"],
              ].map(([box, stock, pending]) => (
                <div
                  key={box}
                  className="mb-3 flex items-center justify-between rounded-lg bg-slate-50 p-4"
                >
                  <div>
                    <p className="text-xl font-black">Caja {box}</p>
                    <p className="font-bold text-slate-500">
                      {pending} pendientes
                    </p>
                  </div>
                  <p className="text-4xl font-black text-slate-900">{stock}</p>
                </div>
              ))}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
