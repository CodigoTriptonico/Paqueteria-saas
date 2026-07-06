import {
  listLogisticsRoutesAction,
} from "@/app/actions/logistics-routes";
import {
  listRouteMembersAction,
  listSalesOwnersAction,
  listShipmentsAction,
} from "@/app/actions/shipments";
import { EnviosClient } from "@/components/envios-client";
import { requirePathAccess } from "@/lib/auth/require";
import { canAccessPath, sessionHasPermission } from "@/lib/auth/permissions";
import { canChangeShipmentSalesOwner } from "@/lib/shipment-visibility";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function EnviosPage() {
  const session = await requirePathAccess("/envios");

  if (!isSupabaseConfigured() || !session) {
    return <EnviosClient />;
  }

  const canManageShipmentOwners = canChangeShipmentSalesOwner(session);
  const [shipmentsResult, membersResult, ownersResult, routesResult] = await Promise.all([
    listShipmentsAction(),
    listRouteMembersAction(),
    canManageShipmentOwners
      ? listSalesOwnersAction()
      : Promise.resolve({ ok: true as const, data: [] }),
    listLogisticsRoutesAction(),
  ]);

  return (
    <EnviosClient
      initialShipments={shipmentsResult.ok ? shipmentsResult.data : []}
      initialRouteMembers={membersResult.ok ? membersResult.data : []}
      initialSalesOwners={ownersResult.ok ? ownersResult.data : []}
      initialRoutes={routesResult.ok ? routesResult.data : []}
      initialRoleSlug={session.roleSlug}
      canManageSales={sessionHasPermission(session, "sales.manage")}
      canUpdateShipmentStatus={sessionHasPermission(session, "routes.update_status")}
      canManageShipmentOwners={canManageShipmentOwners}
      canAccessEstadisticas={canAccessPath(session, "/estadisticas")}
    />
  );
}
