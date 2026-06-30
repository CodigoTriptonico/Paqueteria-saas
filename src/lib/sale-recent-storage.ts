import type { SaleShortcuts } from "@/app/actions/sale-shortcuts";

const STORAGE_KEY = "boxario:venta:recent-sales";
const MAX_ENTRIES = 10;
const RECENT_CUSTOMER_LIMIT = 3;

export type RecentSaleEntry = {
  customerId: string;
  recipientId?: string;
  at: number;
};

function readEntries(): RecentSaleEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as RecentSaleEntry[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (entry) => entry && typeof entry.customerId === "string" && typeof entry.at === "number",
    );
  } catch {
    return [];
  }
}

function writeEntries(entries: RecentSaleEntry[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}

export function recordRecentSale(customerId: string, recipientId?: string) {
  if (!customerId) {
    return;
  }

  const nextEntry: RecentSaleEntry = {
    customerId,
    recipientId: recipientId || undefined,
    at: Date.now(),
  };

  const merged = [
    nextEntry,
    ...readEntries().filter((entry) => entry.customerId !== customerId),
  ].slice(0, MAX_ENTRIES);

  writeEntries(merged);
}

export function readRecentSaleShortcuts(): SaleShortcuts {
  const recentCustomerIds: string[] = [];
  const lastRecipientByCustomerId: Record<string, string> = {};
  const seenCustomers = new Set<string>();

  for (const entry of readEntries()) {
    if (!seenCustomers.has(entry.customerId)) {
      seenCustomers.add(entry.customerId);
      if (recentCustomerIds.length < RECENT_CUSTOMER_LIMIT) {
        recentCustomerIds.push(entry.customerId);
      }
    }

    if (entry.recipientId && !lastRecipientByCustomerId[entry.customerId]) {
      lastRecipientByCustomerId[entry.customerId] = entry.recipientId;
    }
  }

  return { recentCustomerIds, lastRecipientByCustomerId };
}

export function mergeSaleShortcuts(
  primary: SaleShortcuts,
  fallback: SaleShortcuts,
): SaleShortcuts {
  const recentCustomerIds = [...primary.recentCustomerIds];
  const seenCustomers = new Set(recentCustomerIds);

  for (const customerId of fallback.recentCustomerIds) {
    if (seenCustomers.has(customerId)) {
      continue;
    }
    seenCustomers.add(customerId);
    if (recentCustomerIds.length < RECENT_CUSTOMER_LIMIT) {
      recentCustomerIds.push(customerId);
    }
  }

  return {
    recentCustomerIds,
    lastRecipientByCustomerId: {
      ...fallback.lastRecipientByCustomerId,
      ...primary.lastRecipientByCustomerId,
    },
  };
}
