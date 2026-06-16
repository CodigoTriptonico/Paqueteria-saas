import { redirect } from "next/navigation";
import { ClipboardList, PackagePlus, Truck, Users } from "lucide-react";
import { DashboardSummary } from "@/components/dashboard-summary";
import { BigAction, labelMutedClass, Panel } from "@/components/ui-blocks";
import { SupabaseRequiredBanner } from "@/components/supabase-required-banner";
import { platformAdminNeedsClientContext } from "@/lib/auth/permissions";
import { getAppSession } from "@/lib/auth/session";
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

export default async function Home() {
  const session = await getAppSession();
  if (session && platformAdminNeedsClientContext(session)) {
    redirect("/platform");
  }

  const supabaseReady = isSupabaseConfigured() && Boolean(session);

  return (
    <>
      <Panel title="Inicio" hideHeader>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className={labelMutedClass}>Resumen</p>
            <h3 className="truncate text-2xl font-black text-[#f8fafc]">Inicio</h3>
          </div>
        </div>

        {!isSupabaseConfigured() ? (
          <SupabaseRequiredBanner detail="El panel de resumen mostrará métricas cuando existan ventas y envíos en Supabase." />
        ) : supabaseReady ? (
          <DashboardSummary />
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {actions.map((action) => (
            <BigAction key={action.title} {...action} />
          ))}
        </div>
      </Panel>
    </>
  );
}
