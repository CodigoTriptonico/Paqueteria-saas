import {
  listWarehouseTruckArrivalsAction,
} from "@/app/actions/physical-packages";
import { getWarehouseIntakeWorkspaceAction } from "@/app/actions/warehouse-intake";
import { WarehouseIntakeClient } from "@/components/warehouse/warehouse-intake-client";
import { requirePathAccess } from "@/lib/auth/require";
import type { WarehouseIntakeWorkspace } from "@/lib/warehouse-intake";

const emptyWorkspace: WarehouseIntakeWorkspace = {
  sessions: [],
  warehouses: [],
  bins: [],
  availablePackages: [],
  toleranceKg: 0,
  canReopen: false,
};

export default async function IngresoBodegaPage() {
  await requirePathAccess("/ingreso-bodega");
  const [workspace, trucks] = await Promise.all([
    getWarehouseIntakeWorkspaceAction(),
    listWarehouseTruckArrivalsAction(),
  ]);

  return <WarehouseIntakeClient
    initialWorkspace={workspace.ok ? workspace.data : emptyWorkspace}
    initialTruckArrivals={trucks.ok ? trucks.data : []}
    initialError={!workspace.ok ? workspace.error : !trucks.ok ? trucks.error : ""}
  />;
}
