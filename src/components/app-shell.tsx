import Link from "next/link";
import {
  Boxes,
  ClipboardList,
  CreditCard,
  LucideIcon,
  Settings,
  Users,
} from "lucide-react";

const navItems: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Nueva venta", href: "/", icon: CreditCard },
  { label: "Clientes", href: "/clientes", icon: Users },
  { label: "Inventario", href: "/inventario", icon: Boxes },
  { label: "Envios", href: "/envios", icon: ClipboardList },
  { label: "Configuracion", href: "/configuracion", icon: Settings },
];

type AppShellProps = {
  active: string;
  title: string;
  kicker?: string;
  action?: string;
  children: React.ReactNode;
};

export function AppShell({
  active,
  title,
  kicker = "Paqueteria",
  action,
  children,
}: AppShellProps) {
  return (
    <main className="min-h-screen bg-[#f6f7fb] text-slate-950">
      <div className="flex min-h-screen w-full gap-5 p-4 sm:p-5">
        <aside className="hidden w-72 shrink-0 rounded-lg bg-white p-4 shadow-sm lg:block">
          <div className="mb-8 rounded-lg bg-slate-950 p-4 text-white">
            <p className="text-sm font-bold text-slate-300">SaaS</p>
            <h1 className="text-2xl font-black">Paquemas</h1>
          </div>

          <nav className="grid gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.label === active;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex h-14 items-center gap-3 rounded-lg px-4 text-left text-lg font-bold ${
                    isActive
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="h-6 w-6" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="mb-5 rounded-lg bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold uppercase text-slate-500">
                  {kicker}
                </p>
                <h2 className="text-3xl font-black">{title}</h2>
              </div>
              {action ? (
                <button className="h-14 rounded-lg bg-slate-950 px-6 text-lg font-black text-white">
                  {action}
                </button>
              ) : null}
            </div>

            <nav className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5 lg:hidden">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.label === active;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex min-h-16 flex-col items-center justify-center rounded-lg text-center text-sm font-black ${
                      isActive
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    <Icon className="mb-1 h-6 w-6" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </header>

          {children}
        </section>
      </div>
    </main>
  );
}
