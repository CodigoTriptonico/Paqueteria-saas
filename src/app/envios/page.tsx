import { listShipmentsAction } from "@/app/actions/shipments";
import { EnviosClient } from "@/components/envios-client";
import { requirePathAccess } from "@/lib/auth/require";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function EnviosPage() {
  const session = await requirePathAccess("/envios");

  if (!isSupabaseConfigured() || !session) {
    return <EnviosClient />;
  }

  const shipmentsResult = await listShipmentsAction();

  return (
    <EnviosClient
      initialShipments={shipmentsResult.ok ? shipmentsResult.data : []}
      initialRoleSlug={session.roleSlug}
      canManageSales={sessionHasPermission(session, "sales.manage")}
      canUpdateShipmentStatus={sessionHasPermission(session, "routes.update_status")}
    />
  );
}
