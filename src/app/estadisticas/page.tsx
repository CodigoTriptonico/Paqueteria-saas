import { getSellerMetricsAction } from "@/app/actions/seller-metrics";
import { EstadisticasClient } from "@/components/estadisticas-client";
import { requirePathAccess } from "@/lib/auth/require";
import { loadInventarioStatsForSession } from "@/lib/estadisticas/inventario-summary";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function EstadisticasPage() {
  const session = await requirePathAccess("/estadisticas");

  if (!isSupabaseConfigured() || !session) {
    return <EstadisticasClient />;
  }

  const [ventasResult, inventarioStats] = await Promise.all([
    getSellerMetricsAction({ granularity: "day" }),
    loadInventarioStatsForSession(session).catch(() => undefined),
  ]);

  return (
    <EstadisticasClient
      initialVentasReport={ventasResult.ok ? ventasResult.data : undefined}
      initialVentasError={ventasResult.ok ? undefined : ventasResult.error}
      initialInventarioStats={inventarioStats}
    />
  );
}
