import {
  listLogisticsRoutesAction,
  listLogisticsTaskAddressesAction,
} from "@/app/actions/logistics-routes";
import {
  listRouteMembersAction,
  listShipmentsAction,
} from "@/app/actions/shipments";
import { listWarehousesAction } from "@/app/actions/warehouses";
import { LogisticaClient } from "@/components/logistica-client";
import { requirePathAccess } from "@/lib/auth/require";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function LogisticaPage() {
  const session = await requirePathAccess("/logistica");

  if (!isSupabaseConfigured() || !session) {
    return <LogisticaClient />;
  }

  const [shipmentsResult, membersResult, warehousesResult] = await Promise.all([
    listShipmentsAction(),
    listRouteMembersAction(),
    listWarehousesAction(),
  ]);
  const [routesResult, taskAddressesResult] = await Promise.all([
    listLogisticsRoutesAction(),
    listLogisticsTaskAddressesAction(),
  ]);

  return (
    <LogisticaClient
      initialShipments={shipmentsResult.ok ? shipmentsResult.data : []}
      initialRouteMembers={membersResult.ok ? membersResult.data : []}
      initialWarehouses={warehousesResult.ok ? warehousesResult.data : []}
      initialRoutes={routesResult.ok ? routesResult.data : []}
      initialTaskAddresses={taskAddressesResult.ok ? taskAddressesResult.data : []}
    />
  );
}
