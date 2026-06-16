import {
  loadWarehouseInventoryCoreAction,
} from "@/app/actions/inventory";
import { listWarehousesAction } from "@/app/actions/warehouses";
import { InventarioClient } from "@/components/inventario-client";
import { requirePathAccess } from "@/lib/auth/require";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function InventarioPage() {
  const session = await requirePathAccess("/inventario");

  if (!isSupabaseConfigured() || !session) {
    return <InventarioClient />;
  }

  const warehousesResult = await listWarehousesAction();
  const warehouses = warehousesResult.ok
    ? warehousesResult.data.filter((warehouse) => warehouse.is_active)
    : [];
  const defaultWarehouse =
    (session.preferredWarehouseId &&
      warehouses.find((warehouse) => warehouse.id === session.preferredWarehouseId)) ||
    warehouses.find((warehouse) => warehouse.is_default) ||
    warehouses[0];
  const canManageWarehouses = sessionHasPermission(session, "warehouses.manage");

  if (!defaultWarehouse) {
    return (
      <InventarioClient
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
