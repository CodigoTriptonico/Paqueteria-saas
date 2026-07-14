import { listLogisticsRoutesAction } from "@/app/actions/logistics-routes";
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
    return <EnviosClient mode={mode} />;
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
      mode={mode}
      initialShipments={shipmentsResult.ok ? shipmentsResult.data : []}
      initialRouteMembers={membersResult.ok ? membersResult.data : []}
      initialSalesOwners={ownersResult.ok ? ownersResult.data : []}
      initialRoutes={routesResult.ok ? routesResult.data : []}
      initialRoleSlug={session.roleSlug}
      canManageSales={sessionHasPermission(session, "sales.manage")}
      canUpdateShipmentStatus={sessionHasPermission(session, "routes.update_status")}
      canManageShipmentOwners={canManageShipmentOwners}
      canAccessAuditoria={canAccessPath(session, "/auditoria")}
    />
  );
}
