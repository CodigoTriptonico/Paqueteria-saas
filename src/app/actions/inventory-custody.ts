"use server";

import { requireAppSession } from "@/lib/auth/session";
import { canAccessWarehouse, sessionHasPermission } from "@/lib/auth/permissions";
import {
  actionErrorMessage,
  fail,
  ok,
  type ActionResult,
} from "@/lib/actions/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import {
  buildInventoryCustodySnapshot,
  type InventoryCustodyAgencyLot,
  type InventoryCustodySnapshot,
  type InventoryCustodyTruckLine,
} from "@/lib/inventory-custody";
import {
  buildConductorTruckBalance,
  type ConductorTruckInventoryEvent,
} from "@/lib/conductor-truck-inventory";
import { stockRowsToItems, type DbStockRow } from "@/lib/inventory-backend";
import type { PhysicalPackageStatus } from "@/lib/physical-packages";

type LotBalanceRow = {
  inventory_item_id: string | null;
  product_key: string | null;
  box_size: string | null;
  available_quantity: number | null;
  allocated_quantity: number | null;
};

type PackageStatusRow = {
  status: PhysicalPackageStatus;
};

type TruckEventDbRow = {
  id: string;
  vehicle_id: string | null;
  event_type: ConductorTruckInventoryEvent["eventType"];
  route_id: string | null;
  task_id: string | null;
  shipment_id: string | null;
  warehouse_id: string | null;
  item_id: string | null;
  item_name: string | null;
  catalog_key: string | null;
  item_label: string | null;
  qty: number | null;
  created_at: string;
};

function mapTruckEvent(row: TruckEventDbRow): ConductorTruckInventoryEvent {
  return {
    id: row.id,
    eventType: row.event_type,
    routeId: row.route_id,
    taskId: row.task_id,
    shipmentId: row.shipment_id,
    warehouseId: row.warehouse_id,
    itemId: row.item_id,
    itemName: row.item_name || "",
    catalogKey: row.catalog_key || "",
    itemLabel: row.item_label || row.item_name || "",
    qty: Number(row.qty) || 0,
    createdAt: row.created_at,
  };
}

function truckLinesFromBalances(
  balances: ReturnType<typeof buildConductorTruckBalance>[],
): InventoryCustodyTruckLine[] {
  return balances.flatMap((balance) =>
    balance.lines
      .filter((line) => line.currentQty > 0)
      .map((line) => ({
        itemId: line.itemId,
        itemName: line.itemName,
        label: line.label,
        warehouseId: line.warehouseId,
        currentQty: line.currentQty,
      })),
  );
}

export async function loadInventoryCustodySnapshotAction(input: {
  warehouseId: string;
  warehouseName?: string;
}): Promise<ActionResult<InventoryCustodySnapshot>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "inventory.view")) {
      throw new Error("FORBIDDEN");
    }

    if (!input.warehouseId) {
      return fail("Selecciona una bodega.");
    }

    if (!canAccessWarehouse(session, input.warehouseId)) {
      throw new Error("FORBIDDEN");
    }

    const admin = createSupabaseAdminClient();
    const scoped = await createScopedSupabase(session);

    if (!admin || !scoped) {
      return fail("Supabase no configurado");
    }

    const [
      stockResult,
      agencyOrgsResult,
      packageResult,
      eventResult,
      vehicleResult,
      warehouseResult,
    ] = await Promise.all([
      scoped
        .from("inventory_stock")
        .select(
          "id, item_id, warehouse_id, stock, reserved, assigned, unavailable, min_stock, inventory_items(id, name, kind, subcategory, size, location, unit, category_id, inventory_categories(name))",
        )
        .eq("warehouse_id", input.warehouseId)
        .eq("organization_id", session.organizationId),
      admin
        .from("agencies")
        .select("organization_id")
        .eq("matrix_organization_id", session.organizationId)
        .is("archived_at", null),
      admin
        .from("shipment_packages")
        .select("status")
        .eq("organization_id", session.organizationId),
      admin
        .from("logistics_truck_inventory_events")
        .select(
          "id, vehicle_id, event_type, route_id, task_id, shipment_id, warehouse_id, item_id, item_name, catalog_key, item_label, qty, created_at",
        )
        .eq("organization_id", session.organizationId)
        .order("created_at", { ascending: true }),
      admin
        .from("logistics_vehicles")
        .select("id, name, plate, assigned_driver_id, is_active")
        .eq("organization_id", session.organizationId)
        .eq("is_active", true),
      scoped
        .from("warehouses")
        .select("id, name")
        .eq("id", input.warehouseId)
        .eq("organization_id", session.organizationId)
        .maybeSingle(),
    ]);

    if (stockResult.error) {
      return fail(stockResult.error.message);
    }

    if (agencyOrgsResult.error && agencyOrgsResult.error.code !== "42P01") {
      return fail(agencyOrgsResult.error.message);
    }

    if (packageResult.error && packageResult.error.code !== "42P01") {
      return fail(packageResult.error.message);
    }

    if (eventResult.error && eventResult.error.code !== "42P01") {
      return fail(eventResult.error.message);
    }

    if (vehicleResult.error && vehicleResult.error.code !== "42P01") {
      return fail(vehicleResult.error.message);
    }

    const items = stockRowsToItems((stockResult.data || []) as unknown as DbStockRow[]);

    const agencyOrgIds = [
      ...new Set(
        (agencyOrgsResult.data || [])
          .map((row) => row.organization_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    let agencyLots: InventoryCustodyAgencyLot[] = [];

    if (agencyOrgIds.length) {
      const lotsResult = await admin
        .from("agency_box_lot_balances")
        .select(
          "inventory_item_id, product_key, box_size, available_quantity, allocated_quantity",
        )
        .in("organization_id", agencyOrgIds);

      if (lotsResult.error && lotsResult.error.code !== "42P01") {
        return fail(lotsResult.error.message);
      }

      agencyLots = ((lotsResult.data || []) as LotBalanceRow[]).map((row) => ({
        inventoryItemId: row.inventory_item_id,
        productKey: row.product_key || "",
        boxSize: row.box_size || "",
        availableQuantity: Number(row.available_quantity) || 0,
        allocatedQuantity: Number(row.allocated_quantity) || 0,
      }));
    }

    const eventsByVehicle = new Map<string, ConductorTruckInventoryEvent[]>();
    for (const row of (eventResult.data || []) as TruckEventDbRow[]) {
      if (!row.vehicle_id) {
        continue;
      }
      const list = eventsByVehicle.get(row.vehicle_id) || [];
      list.push(mapTruckEvent(row));
      eventsByVehicle.set(row.vehicle_id, list);
    }

    const stockForTruck = items.map((item) => ({
      itemId: item.id,
      itemName: item.name,
      category: item.category,
      kind: item.kind,
      subcategory: item.subcategory,
      warehouseId: input.warehouseId,
      stock: item.stock,
    }));

    const balances = (vehicleResult.data || []).map((vehicle) =>
      buildConductorTruckBalance({
        vehicleId: vehicle.id,
        vehicleName: vehicle.name || "",
        vehiclePlate: vehicle.plate || "",
        assignedDriverId: vehicle.assigned_driver_id,
        events: eventsByVehicle.get(vehicle.id) || [],
        stock: stockForTruck,
      }),
    );

    const truckLines = truckLinesFromBalances(balances);

    const fullCountsByStatus: Partial<Record<PhysicalPackageStatus, number>> = {};
    for (const row of (packageResult.data || []) as PackageStatusRow[]) {
      if (!row.status) {
        continue;
      }
      fullCountsByStatus[row.status] = (fullCountsByStatus[row.status] || 0) + 1;
    }

    const warehouseName =
      input.warehouseName?.trim() || warehouseResult.data?.name || "Bodega";

    return ok(
      buildInventoryCustodySnapshot({
        warehouseId: input.warehouseId,
        warehouseName,
        items,
        truckLines,
        agencyLots,
        fullCountsByStatus,
      }),
    );
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
