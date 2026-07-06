import {
  listLogisticsDriversAction,
  listLogisticsVehiclesAction,
} from "@/app/actions/logistics-fleet";
import { LogisticsFleetAdminClient } from "@/components/logistica/logistics-fleet-admin-client";
import { requirePathAccess } from "@/lib/auth/require";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function LogisticaConductoresPage() {
  const session = await requirePathAccess("/logistica/conductores");

  if (!isSupabaseConfigured() || !session) {
    return <LogisticsFleetAdminClient view="drivers" />;
  }

  const [driversResult, vehiclesResult] = await Promise.all([
    listLogisticsDriversAction(),
    listLogisticsVehiclesAction(),
  ]);

  return (
    <LogisticsFleetAdminClient
      view="drivers"
      initialDrivers={driversResult.ok ? driversResult.data : []}
      initialVehicles={vehiclesResult.ok ? vehiclesResult.data : []}
    />
  );
}
