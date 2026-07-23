import { catalogKeyFromStockItem } from "@/lib/pricing-catalog";
import type { ConductorTruckBalance } from "@/lib/conductor-truck-inventory";
import type { InventoryStockItem } from "@/lib/inventory-stock";
import { normalizeInventoryText } from "@/lib/inventory-tree";
import {
  physicalPackageStatusLabel,
  type PhysicalPackageStatus,
} from "@/lib/physical-packages";

export type InventoryCustodyAgencyRow = {
  agencyId: string;
  agencyName: string;
  productKey: string;
  boxSize: string;
  availableQuantity: number;
  allocatedQuantity: number;
  deliveredQuantity: number;
};

export type InventoryCustodyEmptyRow = {
  key: string;
  label: string;
  productKey: string;
  boxSize: string;
  warehouseAvailable: number;
  reserved: number;
  assigned: number;
  onTruck: number;
  unavailable: number;
  atAgencyAvailable: number;
  atAgencyAllocated: number;
};

export type InventoryCustodyFullCount = {
  status: PhysicalPackageStatus;
  label: string;
  count: number;
};

export type InventoryCustodyServerSnapshot = {
  agencyModuleEnabled: boolean;
  agencyRows: InventoryCustodyAgencyRow[];
  fullPackageCounts: InventoryCustodyFullCount[];
};

export function inventoryCustodyRowKey(productKey: string, boxSize: string) {
  return [
    normalizeInventoryText(productKey || "caja"),
    normalizeInventoryText(boxSize || "estandar"),
  ].join("|");
}

function inventoryCustodyProductLabel(productKey: string, boxSize: string) {
  const key = String(productKey || "Caja").trim() || "Caja";
  const size = String(boxSize || "Estándar").trim() || "Estándar";
  return `${key} · ${size}`;
}

function readItemProductKey(item: InventoryStockItem) {
  return item.subcategory?.trim() || item.kind?.trim() || item.name.trim() || "Caja";
}

function readItemBoxSize(item: InventoryStockItem) {
  return item.size?.trim() || "Estándar";
}

function ensureEmptyRow(
  map: Map<string, InventoryCustodyEmptyRow>,
  productKey: string,
  boxSize: string,
) {
  const key = inventoryCustodyRowKey(productKey, boxSize);
  const existing = map.get(key);

  if (existing) {
    return existing;
  }

  const row: InventoryCustodyEmptyRow = {
    key,
    label: inventoryCustodyProductLabel(productKey, boxSize),
    productKey,
    boxSize,
    warehouseAvailable: 0,
    reserved: 0,
    assigned: 0,
    onTruck: 0,
    unavailable: 0,
    atAgencyAvailable: 0,
    atAgencyAllocated: 0,
  };
  map.set(key, row);
  return row;
}

export function sumTruckQtyByCatalogKey(truckBalances: ReadonlyArray<ConductorTruckBalance>) {
  const totals = new Map<string, number>();

  for (const balance of truckBalances) {
    for (const line of balance.lines) {
      if (line.currentQty <= 0) {
        continue;
      }

      const catalogKey = String(line.catalogKey || "").trim();
      const label = String(line.label || "").trim();
      const keys = [
        catalogKey ? `catalog:${normalizeInventoryText(catalogKey)}` : "",
        label ? `label:${normalizeInventoryText(label)}` : "",
      ].filter(Boolean);

      for (const key of keys) {
        totals.set(key, (totals.get(key) || 0) + line.currentQty);
      }
    }
  }

  return totals;
}

type CustodyRowMeta = {
  catalogKeys: Set<string>;
  labels: Set<string>;
  productKeys: Set<string>;
};

function ensureEmptyRowMeta(meta: Map<string, CustodyRowMeta>, key: string) {
  const existing = meta.get(key);

  if (existing) {
    return existing;
  }

  const created: CustodyRowMeta = {
    catalogKeys: new Set(),
    labels: new Set(),
    productKeys: new Set(),
  };
  meta.set(key, created);
  return created;
}

function resolveTruckQtyForRow(
  truckTotals: Map<string, number>,
  meta: CustodyRowMeta,
) {
  for (const catalogKey of meta.catalogKeys) {
    const qty = truckTotals.get(`catalog:${normalizeInventoryText(catalogKey)}`);
    if (qty) {
      return qty;
    }
  }

  for (const label of meta.labels) {
    const qty = truckTotals.get(`label:${normalizeInventoryText(label)}`);
    if (qty) {
      return qty;
    }
  }

  for (const productKey of meta.productKeys) {
    const qty = truckTotals.get(`label:${normalizeInventoryText(productKey)}`);
    if (qty) {
      return qty;
    }
  }

  return 0;
}

export function buildInventoryCustodyEmptyRows(input: {
  items: ReadonlyArray<InventoryStockItem>;
  truckBalances?: ReadonlyArray<ConductorTruckBalance>;
  agencyRows?: ReadonlyArray<InventoryCustodyAgencyRow>;
}): InventoryCustodyEmptyRow[] {
  const map = new Map<string, InventoryCustodyEmptyRow>();
  const metaByKey = new Map<string, CustodyRowMeta>();
  const truckTotals = sumTruckQtyByCatalogKey(input.truckBalances || []);

  for (const item of input.items) {
    const productKey = readItemProductKey(item);
    const boxSize = readItemBoxSize(item);
    const row = ensureEmptyRow(map, productKey, boxSize);
    const meta = ensureEmptyRowMeta(metaByKey, row.key);
    row.warehouseAvailable += Math.max(0, item.stock - item.reserved);
    row.reserved += Math.max(0, item.reserved);
    row.assigned += Math.max(0, item.assigned);
    row.unavailable += Math.max(0, item.unavailable);
    meta.catalogKeys.add(catalogKeyFromStockItem(item));
    meta.labels.add(row.label);
    meta.productKeys.add(productKey);
  }

  for (const agencyRow of input.agencyRows || []) {
    const row = ensureEmptyRow(map, agencyRow.productKey, agencyRow.boxSize);
    const meta = ensureEmptyRowMeta(metaByKey, row.key);
    row.atAgencyAvailable += Math.max(0, agencyRow.availableQuantity);
    row.atAgencyAllocated += Math.max(0, agencyRow.allocatedQuantity);
    meta.labels.add(row.label);
    meta.productKeys.add(agencyRow.productKey);
  }

  for (const row of map.values()) {
    const meta = metaByKey.get(row.key);
    row.onTruck = meta ? resolveTruckQtyForRow(truckTotals, meta) : 0;
  }

  return [...map.values()]
    .filter((row) =>
      row.warehouseAvailable +
        row.reserved +
        row.assigned +
        row.onTruck +
        row.unavailable +
        row.atAgencyAvailable +
        row.atAgencyAllocated >
      0,
    )
    .sort((left, right) => left.label.localeCompare(right.label, "es"));
}

export function sumInventoryCustodyEmptyRows(rows: ReadonlyArray<InventoryCustodyEmptyRow>) {
  return rows.reduce(
    (totals, row) => ({
      warehouseAvailable: totals.warehouseAvailable + row.warehouseAvailable,
      reserved: totals.reserved + row.reserved,
      assigned: totals.assigned + row.assigned,
      onTruck: totals.onTruck + row.onTruck,
      unavailable: totals.unavailable + row.unavailable,
      atAgencyAvailable: totals.atAgencyAvailable + row.atAgencyAvailable,
      atAgencyAllocated: totals.atAgencyAllocated + row.atAgencyAllocated,
    }),
    {
      warehouseAvailable: 0,
      reserved: 0,
      assigned: 0,
      onTruck: 0,
      unavailable: 0,
      atAgencyAvailable: 0,
      atAgencyAllocated: 0,
    },
  );
}

const FULL_PACKAGE_STATUS_ORDER: PhysicalPackageStatus[] = [
  "awaiting_full_box",
  "in_truck",
  "pending_intake",
  "warehouse_intake",
  "in_warehouse",
  "on_pallet",
  "handed_to_carrier",
];

export function buildInventoryCustodyFullCounts(
  counts: Partial<Record<PhysicalPackageStatus, number>>,
): InventoryCustodyFullCount[] {
  return FULL_PACKAGE_STATUS_ORDER.map((status) => ({
    status,
    label: physicalPackageStatusLabel[status],
    count: Math.max(0, Number(counts[status]) || 0),
  })).filter((row) => row.count > 0);
}

export function sumInventoryCustodyFullCounts(rows: ReadonlyArray<InventoryCustodyFullCount>) {
  return rows.reduce((total, row) => total + row.count, 0);
}

export const inventoryCustodyEmptyColumnLabels = {
  warehouseAvailable: "Bodega",
  reserved: "Reservado",
  assigned: "Asignado",
  onTruck: "Camión",
  atAgencyAvailable: "Agencia",
  atAgencyAllocated: "En envío",
  unavailable: "No usable",
} as const;
