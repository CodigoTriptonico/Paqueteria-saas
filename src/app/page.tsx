import { ClipboardList, PackagePlus, Truck, Users } from "lucide-react";
import { BigAction, labelMutedClass, Panel } from "@/components/ui-blocks";
import { SupabaseRequiredBanner } from "@/components/supabase-required-banner";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const actions = [
  {
    title: "Nueva venta",
    text: "Crear envio o vender caja.",
    icon: PackagePlus,
    color: "bg-emerald-400",
    href: "/venta",
  },
  {
    title: "Clientes",
    text: "Remitentes y destinatarios.",
    icon: Users,
    color: "bg-emerald-400",
    href: "/venta",
  },
  {
    title: "Pickups",
    text: "Recoger o entregar cajas.",
    icon: Truck,
    color: "bg-emerald-400",
    href: "/envios",
  },
  {
    title: "Envios",
    text: "Historial y estados.",
    icon: ClipboardList,
    color: "bg-emerald-400",
    href: "/envios",
  },
];

export default function Home() {
  const supabaseReady = isSupabaseConfigured();

  return (
    <>
      <Panel title="Inicio" hideHeader>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className={labelMutedClass}>Resumen</p>
            <h3 className="truncate text-2xl font-black text-[#f8fafc]">Inicio</h3>
          </div>
        </div>

        {!supabaseReady ? (
          <SupabaseRequiredBanner detail="El panel de resumen mostrará métricas cuando existan ventas y envíos en Supabase." />
        ) : (
          <p className="mb-4 rounded-lg border border-black bg-surface-card px-4 py-3 text-sm font-bold text-slate-300">
            Sin métricas agregadas aún. Los datos de actividad vendrán de ventas y envíos registrados en la base de
            datos.
          </p>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {actions.map((action) => (
            <BigAction key={action.title} {...action} />
          ))}
        </div>
      </Panel>
    </>
  );
}
