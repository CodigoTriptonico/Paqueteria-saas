import {
  listWarehousePackagesAction,
  listWarehouseTruckArrivalsAction,
} from "@/app/actions/physical-packages";
import { WarehouseIntakeClient } from "@/components/warehouse/warehouse-intake-client";
import { requirePathAccess } from "@/lib/auth/require";
export default async function IngresoBodegaPage() {
  await requirePathAccess("/ingreso-bodega");
  const [pending, received, trucks] = await Promise.all([
    listWarehousePackagesAction(["pending_intake"]),
    listWarehousePackagesAction(["warehouse_intake"]),
    listWarehouseTruckArrivalsAction(),
  ]);

  return <WarehouseIntakeClient
    initialPackages={pending.ok ? pending.data : []}
    initialReceived={received.ok ? received.data : []}
    initialTruckArrivals={trucks.ok ? trucks.data : []}
  />;
}
