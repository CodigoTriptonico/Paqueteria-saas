import { getSellerMetricsAction } from "@/app/actions/seller-metrics";
import { getDistributionMetricsAction } from "@/app/actions/distribution-metrics";
import { EstadisticasClient } from "@/components/estadisticas-client";
import { requirePathAccess } from "@/lib/auth/require";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function EstadisticasPage() {
  const session = await requirePathAccess("/estadisticas");

  if (!isSupabaseConfigured() || !session) {
    return <EstadisticasClient />;
  }

  const [ventasResult, distributionResult] = await Promise.all([
    getSellerMetricsAction({ granularity: "day" }),
    getDistributionMetricsAction({ granularity: "day" }),
  ]);

  return (
    <EstadisticasClient
      initialVentasReport={ventasResult.ok ? ventasResult.data : undefined}
      initialVentasError={ventasResult.ok ? undefined : ventasResult.error}
      initialDistributionReport={distributionResult.ok ? distributionResult.data : undefined}
      initialDistributionError={distributionResult.ok ? undefined : distributionResult.error}
    />
  );
}
