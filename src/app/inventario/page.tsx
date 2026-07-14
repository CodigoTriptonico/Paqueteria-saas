import {
  loadWarehouseInventoryCoreAction,
} from "@/app/actions/inventory";
import { listConductorTruckBalancesAction } from "@/app/actions/conductor-tasks";
import { listWarehousesAction } from "@/app/actions/warehouses";
import { InventarioClient } from "@/components/inventario-client";
import { requirePathAccess } from "@/lib/auth/require";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { loadPricingConfigForSession } from "@/lib/pricing/load-config";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { ConductorTruckBalance } from "@/lib/conductor-truck-inventory";

export default async function InventarioPage() {
  const session = await requirePathAccess("/inventario");

  if (!isSupabaseConfigured() || !session) {
    return <InventarioClient />;
  }

  const warehousesResult = await listWarehousesAction();
  const truckBalancesResult = await listConductorTruckBalancesAction();
  const truckBalances: ConductorTruckBalance[] = truckBalancesResult.ok
    ? truckBalancesResult.data
    : [];
  const warehouses = warehousesResult.ok
    ? warehousesResult.data.filter((warehouse) => warehouse.is_active)
    : [];
  const defaultWarehouse =
    (session.preferredWarehouseId &&
      warehouses.find((warehouse) => warehouse.id === session.preferredWarehouseId)) ||
    warehouses.find((warehouse) => warehouse.is_default) ||
    warehouses[0];
  const canManageWarehouses = sessionHasPermission(session, "warehouses.manage");
  let initialPricing = undefined;

  try {
    initialPricing = await loadPricingConfigForSession(session);
  } catch {
    initialPricing = undefined;
  }

  if (!defaultWarehouse) {
    return (
      <InventarioClient
        initialTruckBalances={truckBalances}
        initialPricing={initialPricing}
        initialData={{
          warehouses,
          warehouseId: "",
          multiWarehouse: session.multiWarehouseEnabled,
          canManageWarehouses,
          categoryConfigs: [],
          items: [],
          movements: [],
          assignments: [],
        }}
      />
    );
  }

  const inventoryResult = await loadWarehouseInventoryCoreAction(defaultWarehouse.id);

  return (
    <InventarioClient
      initialTruckBalances={truckBalances}
      initialPricing={initialPricing}
      initialData={{
        warehouses,
        warehouseId: defaultWarehouse.id,
        multiWarehouse: session.multiWarehouseEnabled,
        canManageWarehouses,
        categoryConfigs: inventoryResult.ok ? inventoryResult.data.categoryConfigs : [],
        items: inventoryResult.ok ? inventoryResult.data.items : [],
        movements: [],
        assignments: [],
      }}
    />
  );
}
