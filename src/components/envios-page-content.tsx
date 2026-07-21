import { listPendingCustomerRouteAssignmentTaskIdsAction } from "@/app/actions/customer-route-assignments";
import { listLogisticsRouteCatalogAction, listLogisticsRoutesAction } from "@/app/actions/logistics-routes";
import {
  listRouteMembersAction,
  listSalesOwnersAction,
  listShipmentsAction,
} from "@/app/actions/shipments";
import { EnviosClient } from "@/components/envios-client";
import { canAccessPath, sessionHasPermission } from "@/lib/auth/permissions";
import { requirePathAccess } from "@/lib/auth/require";
import { canChangeShipmentSalesOwner } from "@/lib/shipment-visibility";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type EnviosPageContentProps = {
  mode: "history" | "tracking";
};

export async function EnviosPageContent({ mode }: EnviosPageContentProps) {
  const session = await requirePathAccess("/seguimiento");

  if (!isSupabaseConfigured() || !session) {
    return <EnviosClient mode={mode} unified />;
  }

  const canManageShipmentOwners = canChangeShipmentSalesOwner(session);
  const canManageSales = sessionHasPermission(session, "sales.manage");
  const [shipmentsResult, membersResult, ownersResult, routesResult, catalogResult, pendingRouteTasksResult] =
    await Promise.all([
      listShipmentsAction(),
      listRouteMembersAction(),
      canManageShipmentOwners
        ? listSalesOwnersAction()
        : Promise.resolve({ ok: true as const, data: [] }),
      listLogisticsRoutesAction(),
      canManageSales
        ? listLogisticsRouteCatalogAction()
        : Promise.resolve({ ok: true as const, data: null }),
      canManageSales || sessionHasPermission(session, "routes.view")
        ? listPendingCustomerRouteAssignmentTaskIdsAction()
        : Promise.resolve({ ok: true as const, data: [] as string[] }),
    ]);

  return (
    <EnviosClient
      mode={mode}
      unified
      initialShipments={shipmentsResult.ok ? shipmentsResult.data : []}
      initialRouteMembers={membersResult.ok ? membersResult.data : []}
      initialSalesOwners={ownersResult.ok ? ownersResult.data : []}
      initialRoutes={routesResult.ok ? routesResult.data : []}
      initialRouteCatalog={catalogResult.ok ? catalogResult.data : null}
      initialPendingRouteTaskIds={pendingRouteTasksResult.ok ? pendingRouteTasksResult.data : []}
      initialRoleSlug={session.roleSlug}
      canManageSales={canManageSales}
      canUpdateShipmentStatus={sessionHasPermission(session, "routes.update_status")}
      canManageShipmentOwners={canManageShipmentOwners}
      canAccessAuditoria={canAccessPath(session, "/auditoria")}
    />
  );
}
