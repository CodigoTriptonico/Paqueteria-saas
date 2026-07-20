import type { PhysicalPackageStatus } from "@/lib/physical-packages";
import { physicalPackageStatusLabel } from "@/lib/physical-packages";
import type { InventoryStockItem } from "@/lib/inventory-stock";

export type EmptyBoxCustodyBuckets = {
  warehouse: number;
  assigned: number;
  reserved: number;
  inTruck: number;
  agencyAvailable: number;
  agencyAllocated: number;
  unavailable: number;
};

export type EmptyBoxCustodyRow = {
  itemId: string;
  itemName: string;
  category: string;
  kind: string;
  size?: string;
  buckets: EmptyBoxCustodyBuckets;
};

export type FullBoxCustodyBucket = {
  status: PhysicalPackageStatus;
  label: string;
  count: number;
};

export type InventoryCustodyAgencyLot = {
  inventoryItemId: string | null;
  productKey: string;
  boxSize: string;
  availableQuantity: number;
  allocatedQuantity: number;
};

export type InventoryCustodyTruckLine = {
  itemId: string | null;
  itemName: string;
  label: string;
  warehouseId: string | null;
  currentQty: number;
};

export type InventoryCustodySnapshot = {
  warehouseId: string;
  warehouseName: string;
  emptyRows: EmptyBoxCustodyRow[];
  fullBuckets: FullBoxCustodyBucket[];
  emptyTotals: EmptyBoxCustodyBuckets;
  fullTotal: number;
};

export const EMPTY_CUSTODY_BUCKET_LABELS: Record<keyof EmptyBoxCustodyBuckets, string> = {
  warehouse: "Bodega",
  assigned: "Empleados",
  reserved: "Reservado",
  inTruck: "Camión",
  agencyAvailable: "Agencias",
  agencyAllocated: "Asignadas a envío",
  unavailable: "No usable",
};

const FULL_STATUS_ORDER: PhysicalPackageStatus[] = [
  "awaiting_full_box",
  "in_truck",
  "pending_intake",
  "warehouse_intake",
  "in_warehouse",
  "on_pallet",
  "handed_to_carrier",
];

function emptyBuckets(): EmptyBoxCustodyBuckets {
  return {
    warehouse: 0,
    assigned: 0,
    reserved: 0,
    inTruck: 0,
    agencyAvailable: 0,
    agencyAllocated: 0,
    unavailable: 0,
  };
}

export function sumEmptyBuckets(rows: ReadonlyArray<EmptyBoxCustodyRow>): EmptyBoxCustodyBuckets {
  return rows.reduce<EmptyBoxCustodyBuckets>((totals, row) => {
    for (const key of Object.keys(totals) as (keyof EmptyBoxCustodyBuckets)[]) {
      totals[key] += row.buckets[key];
    }
    return totals;
  }, emptyBuckets());
}

export function emptyRowTrackedTotal(buckets: EmptyBoxCustodyBuckets): number {
  return (
    buckets.warehouse +
    buckets.assigned +
    buckets.reserved +
    buckets.inTruck +
    buckets.agencyAvailable +
    buckets.agencyAllocated +
    buckets.unavailable
  );
}

function lotMatchesItem(
  lot: InventoryCustodyAgencyLot,
  item: Pick<InventoryStockItem, "id" | "name" | "subcategory" | "size">,
): boolean {
  if (lot.inventoryItemId && lot.inventoryItemId === item.id) {
    return true;
  }

  const productKey = (item.subcategory || item.name || "").trim().toLowerCase();
  const boxSize = (item.size || "").trim().toLowerCase();
  const lotKey = lot.productKey.trim().toLowerCase();
  const lotSize = lot.boxSize.trim().toLowerCase();

  if (!productKey || !lotKey) {
    return false;
  }

  if (productKey !== lotKey) {
    return false;
  }

  if (!boxSize || !lotSize) {
    return true;
  }

  return boxSize === lotSize;
}

function truckMatchesItem(
  line: InventoryCustodyTruckLine,
  item: Pick<InventoryStockItem, "id" | "name">,
  warehouseId: string,
): boolean {
  if (line.currentQty <= 0) {
    return false;
  }

  if (line.warehouseId && line.warehouseId !== warehouseId) {
    return false;
  }

  if (line.itemId && line.itemId === item.id) {
    return true;
  }

  const needle = item.name.trim().toLowerCase();
  if (!needle) {
    return false;
  }

  return (
    line.itemName.trim().toLowerCase() === needle ||
    line.label.trim().toLowerCase().includes(needle)
  );
}

export function buildEmptyBoxCustodyRows(input: {
  warehouseId: string;
  items: ReadonlyArray<InventoryStockItem>;
  truckLines: ReadonlyArray<InventoryCustodyTruckLine>;
  agencyLots: ReadonlyArray<InventoryCustodyAgencyLot>;
}): EmptyBoxCustodyRow[] {
  const rows: EmptyBoxCustodyRow[] = [];

  for (const item of input.items) {
    const buckets = emptyBuckets();
    buckets.warehouse = Math.max(0, item.stock || 0);
    buckets.assigned = Math.max(0, item.assigned || 0);
    buckets.reserved = Math.max(0, item.reserved || 0);
    buckets.unavailable = Math.max(0, item.unavailable || 0);

    for (const line of input.truckLines) {
      if (truckMatchesItem(line, item, input.warehouseId)) {
        buckets.inTruck += Math.max(0, line.currentQty || 0);
      }
    }

    for (const lot of input.agencyLots) {
      if (!lotMatchesItem(lot, item)) {
        continue;
      }
      buckets.agencyAvailable += Math.max(0, lot.availableQuantity || 0);
      buckets.agencyAllocated += Math.max(0, lot.allocatedQuantity || 0);
    }

    if (emptyRowTrackedTotal(buckets) <= 0) {
      continue;
    }

    rows.push({
      itemId: item.id,
      itemName: item.name,
      category: item.category,
      kind: item.kind,
      size: item.size,
      buckets,
    });
  }

  return rows.sort((left, right) => {
    const leftTotal = emptyRowTrackedTotal(left.buckets);
    const rightTotal = emptyRowTrackedTotal(right.buckets);
    if (rightTotal !== leftTotal) {
      return rightTotal - leftTotal;
    }
    return left.itemName.localeCompare(right.itemName, "es");
  });
}

export function buildFullBoxCustodyBuckets(
  countsByStatus: Partial<Record<PhysicalPackageStatus, number>>,
): FullBoxCustodyBucket[] {
  return FULL_STATUS_ORDER.map((status) => ({
    status,
    label: physicalPackageStatusLabel[status],
    count: Math.max(0, countsByStatus[status] || 0),
  }));
}

export function buildInventoryCustodySnapshot(input: {
  warehouseId: string;
  warehouseName: string;
  items: ReadonlyArray<InventoryStockItem>;
  truckLines: ReadonlyArray<InventoryCustodyTruckLine>;
  agencyLots: ReadonlyArray<InventoryCustodyAgencyLot>;
  fullCountsByStatus: Partial<Record<PhysicalPackageStatus, number>>;
}): InventoryCustodySnapshot {
  const emptyRows = buildEmptyBoxCustodyRows({
    warehouseId: input.warehouseId,
    items: input.items,
    truckLines: input.truckLines,
    agencyLots: input.agencyLots,
  });
  const fullBuckets = buildFullBoxCustodyBuckets(input.fullCountsByStatus);

  return {
    warehouseId: input.warehouseId,
    warehouseName: input.warehouseName,
    emptyRows,
    fullBuckets,
    emptyTotals: sumEmptyBuckets(emptyRows),
    fullTotal: fullBuckets.reduce((sum, bucket) => sum + bucket.count, 0),
  };
}
