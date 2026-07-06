import type { ShipmentRow } from "@/app/actions/shipments";
import {
  reconcileShipmentDisplayOrderIds,
  shipmentVisibleIdSetKey,
  sortShipmentsByArrivalOrder,
} from "@/lib/shipment-display";

const STORAGE_PREFIX = "envios:display-order:";

export function enviosDisplayOrderStorageKey(filterSignature: string) {
  return `${STORAGE_PREFIX}${filterSignature}`;
}

export function readEnviosDisplayOrder(storageKey: string): string[] | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every((entry) => typeof entry === "string")) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function writeEnviosDisplayOrder(storageKey: string, orderIds: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(orderIds));
  } catch {
    // Ignore quota / private mode errors.
  }
}

export function storedEnviosDisplayOrderMatchesRows<T extends Pick<ShipmentRow, "id">>(
  storedOrderIds: string[] | null | undefined,
  rows: T[],
): storedOrderIds is string[] {
  if (!storedOrderIds || storedOrderIds.length !== rows.length) {
    return false;
  }

  const rowIdSet = new Set(rows.map((row) => row.id));
  return storedOrderIds.every((id) => rowIdSet.has(id));
}

export function resolveEnviosDisplayOrderIds<T extends Pick<ShipmentRow, "id" | "created_at">>(
  rows: T[],
  options: {
    previousOrderIds?: string[];
    filterChanged?: boolean;
    storedOrderIds?: string[] | null;
  } = {},
): string[] {
  const { previousOrderIds = [], filterChanged = false, storedOrderIds = null } = options;

  if (filterChanged || previousOrderIds.length === 0) {
    if (!filterChanged && storedEnviosDisplayOrderMatchesRows(storedOrderIds, rows)) {
      return storedOrderIds;
    }

    return sortShipmentsByArrivalOrder(rows).map((row) => row.id);
  }

  if (previousOrderIds.length > 0) {
    return reconcileShipmentDisplayOrderIds(previousOrderIds, rows);
  }

  if (storedEnviosDisplayOrderMatchesRows(storedOrderIds, rows)) {
    return storedOrderIds;
  }

  return sortShipmentsByArrivalOrder(rows).map((row) => row.id);
}

export function shipmentDisplayOrderFilterSignature(input: {
  query: string;
  country: string;
  statusFilter: string;
  salesOwnerFilter: string;
}) {
  return [input.query.trim(), input.country.trim(), input.statusFilter.trim(), input.salesOwnerFilter]
    .join("\0");
}

export { shipmentVisibleIdSetKey };
