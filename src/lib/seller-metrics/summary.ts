import type { AppSession } from "@/lib/auth/types";
import { canManageAllShipments } from "@/lib/shipment-visibility";
import { isSalesOwnerRole } from "@/lib/shipment-sales-owner";
import type { RoleSlug } from "@/lib/auth/types";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import {
  anchorDateKey,
  dayKeyFromIso,
  defaultRangeKeys,
  formatDayLabel,
  listDayKeysInPeriod,
  normalizeAnchorDate,
  normalizeRangeKeys,
  periodBounds,
  periodLabel,
  type PeriodGranularity,
} from "@/lib/seller-metrics/period-buckets";

export type SellerSaleRow = {
  salesOwnerId: string | null;
  salesOwnerName: string;
  paid: number;
  profit: number;
  saleKind: string;
  createdAt: string;
  invoiceStatus: string;
};

export type SellerOwnerRow = {
  id: string;
  label: string;
};

export type SellerMetricsRow = {
  rank: number;
  salesOwnerId: string;
  salesOwnerName: string;
  saleCount: number;
  openCount: number;
  closedCount: number;
  totalPaid: number;
  totalProfit: number;
  fullSales: number;
  depositSales: number;
  averageTicket: number;
  sharePercent: number;
};

export type PeriodBreakdownRow = {
  dayKey: string;
  label: string;
  saleCount: number;
  openCount: number;
  closedCount: number;
  totalPaid: number;
};

export type SellerMetricsReport = {
  granularity: PeriodGranularity;
  periodLabel: string;
  anchorDate: string;
  rangeFrom: string | null;
  rangeTo: string | null;
  periodStart: string;
  periodEnd: string;
  totals: {
    saleCount: number;
    openCount: number;
    closedCount: number;
    totalPaid: number;
    totalProfit: number;
    activeSellers: number;
  };
  sellers: SellerMetricsRow[];
  dailyBreakdown: PeriodBreakdownRow[];
};

type SellerAccumulator = {
  salesOwnerId: string;
  salesOwnerName: string;
  saleCount: number;
  openCount: number;
  closedCount: number;
  totalPaid: number;
  totalProfit: number;
  fullSales: number;
  depositSales: number;
};

function profileLabel(
  profile:
    | { full_name?: string | null; email?: string | null }
    | { full_name?: string | null; email?: string | null }[]
    | null
    | undefined,
) {
  const row = Array.isArray(profile) ? profile[0] : profile;
  return ((row?.full_name as string | null) || (row?.email as string) || "").trim();
}

function isClosedSale(invoiceStatus: string) {
  return invoiceStatus === "paid";
}

export function aggregateSellerMetrics(input: {
  sales: SellerSaleRow[];
  owners: SellerOwnerRow[];
  granularity: PeriodGranularity;
  anchor: Date;
  rangeFrom?: string | null;
  rangeTo?: string | null;
}): SellerMetricsReport {
  const anchor = normalizeAnchorDate(input.anchor);
  const rangeKeys =
    input.granularity === "range"
      ? input.rangeFrom && input.rangeTo
        ? normalizeRangeKeys(input.rangeFrom, input.rangeTo)
        : defaultRangeKeys(anchor)
      : null;
  const { start, end } = periodBounds(anchor, input.granularity, rangeKeys);
  const dayKeys = listDayKeysInPeriod(start, end);
  const breakdownMap = new Map<
    string,
    { saleCount: number; openCount: number; closedCount: number; totalPaid: number }
  >(dayKeys.map((dayKey) => [dayKey, { saleCount: 0, openCount: 0, closedCount: 0, totalPaid: 0 }]));

  const sellerMap = new Map<string, SellerAccumulator>(
    input.owners.map((owner) => [
      owner.id,
      {
        salesOwnerId: owner.id,
        salesOwnerName: owner.label,
        saleCount: 0,
        openCount: 0,
        closedCount: 0,
        totalPaid: 0,
        totalProfit: 0,
        fullSales: 0,
        depositSales: 0,
      },
    ]),
  );

  let orgSaleCount = 0;
  let orgOpenCount = 0;
  let orgClosedCount = 0;
  let orgTotalPaid = 0;
  let orgTotalProfit = 0;

  for (const sale of input.sales) {
    if (!sale.salesOwnerId || sale.invoiceStatus === "void") {
      continue;
    }

    const createdAt = new Date(sale.createdAt);
    if (Number.isNaN(createdAt.getTime()) || createdAt < start || createdAt >= end) {
      continue;
    }

    const closed = isClosedSale(sale.invoiceStatus);
    const dayKey = dayKeyFromIso(sale.createdAt);
    const breakdown = breakdownMap.get(dayKey);
    if (breakdown) {
      breakdown.saleCount += 1;
      breakdown.totalPaid += sale.paid;
      if (closed) {
        breakdown.closedCount += 1;
      } else {
        breakdown.openCount += 1;
      }
    }

    orgSaleCount += 1;
    orgTotalPaid += sale.paid;
    orgTotalProfit += sale.profit;
    if (closed) {
      orgClosedCount += 1;
    } else {
      orgOpenCount += 1;
    }

    let seller = sellerMap.get(sale.salesOwnerId);
    if (!seller) {
      seller = {
        salesOwnerId: sale.salesOwnerId,
        salesOwnerName: sale.salesOwnerName || "Sin vendedor",
        saleCount: 0,
        openCount: 0,
        closedCount: 0,
        totalPaid: 0,
        totalProfit: 0,
        fullSales: 0,
        depositSales: 0,
      };
      sellerMap.set(sale.salesOwnerId, seller);
    }

    seller.saleCount += 1;
    seller.totalPaid += sale.paid;
    seller.totalProfit += sale.profit;
    if (closed) {
      seller.closedCount += 1;
    } else {
      seller.openCount += 1;
    }

    if (sale.saleKind === "empty_box_deposit") {
      seller.depositSales += 1;
    } else {
      seller.fullSales += 1;
    }
  }

  const sellers = [...sellerMap.values()]
    .sort((left, right) => {
      if (right.saleCount !== left.saleCount) {
        return right.saleCount - left.saleCount;
      }
      if (right.totalPaid !== left.totalPaid) {
        return right.totalPaid - left.totalPaid;
      }
      return left.salesOwnerName.localeCompare(right.salesOwnerName, "es");
    })
    .map((row, index) => ({
      rank: index + 1,
      salesOwnerId: row.salesOwnerId,
      salesOwnerName: row.salesOwnerName,
      saleCount: row.saleCount,
      openCount: row.openCount,
      closedCount: row.closedCount,
      totalPaid: row.totalPaid,
      totalProfit: row.totalProfit,
      fullSales: row.fullSales,
      depositSales: row.depositSales,
      averageTicket: row.saleCount > 0 ? row.totalPaid / row.saleCount : 0,
      sharePercent: orgSaleCount > 0 ? (row.saleCount / orgSaleCount) * 100 : 0,
    }));

  const activeSellers = sellers.filter((row) => row.saleCount > 0).length;

  return {
    granularity: input.granularity,
    periodLabel: periodLabel(anchor, input.granularity, rangeKeys),
    anchorDate: rangeKeys?.from || anchorDateKey(anchor),
    rangeFrom: rangeKeys?.from || null,
    rangeTo: rangeKeys?.to || null,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    totals: {
      saleCount: orgSaleCount,
      openCount: orgOpenCount,
      closedCount: orgClosedCount,
      totalPaid: orgTotalPaid,
      totalProfit: orgTotalProfit,
      activeSellers,
    },
    sellers,
    dailyBreakdown: dayKeys.map((dayKey) => {
      const bucket = breakdownMap.get(dayKey) || {
        saleCount: 0,
        openCount: 0,
        closedCount: 0,
        totalPaid: 0,
      };
      return {
        dayKey,
        label: formatDayLabel(dayKey),
        saleCount: bucket.saleCount,
        openCount: bucket.openCount,
        closedCount: bucket.closedCount,
        totalPaid: bucket.totalPaid,
      };
    }),
  };
}

export async function loadSellerMetricsForSession(
  session: AppSession,
  input: {
    granularity: PeriodGranularity;
    anchorDate?: string | null;
    rangeFrom?: string | null;
    rangeTo?: string | null;
  },
): Promise<SellerMetricsReport> {
  if (!canManageAllShipments(session)) {
    throw new Error("FORBIDDEN");
  }

  const supabase = await createScopedSupabase(session);
  if (!supabase) {
    throw new Error("Supabase no configurado");
  }

  const anchor = normalizeAnchorDate(input.anchorDate || undefined);
  const range =
    input.granularity === "range" && input.rangeFrom && input.rangeTo
      ? { from: input.rangeFrom, to: input.rangeTo }
      : null;
  const { start, end } = periodBounds(anchor, input.granularity, range);
  const orgId = session.organizationId;

  const [salesResult, ownersResult] = await Promise.all([
    supabase
      .from("shipments")
      .select(
        "sales_owner_id, paid, profit, sale_kind, created_at, invoice_status, sales_owner_profile:profiles!shipments_sales_owner_id_fkey(full_name, email)",
      )
      .eq("organization_id", orgId)
      .neq("invoice_status", "void")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString()),
    supabase
      .from("profiles")
      .select("id, email, full_name, roles(slug, name)")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .order("full_name"),
  ]);

  if (salesResult.error) {
    throw new Error(salesResult.error.message);
  }

  if (ownersResult.error) {
    throw new Error(ownersResult.error.message);
  }

  const owners: SellerOwnerRow[] = (ownersResult.data || [])
    .map((row) => {
      const roleRow = row.roles as
        | { slug: RoleSlug; name: string }
        | { slug: RoleSlug; name: string }[]
        | null;
      const role = Array.isArray(roleRow) ? roleRow[0] : roleRow;
      return {
        id: row.id as string,
        label: ((row.full_name as string | null) || (row.email as string) || "Usuario").trim(),
        roleSlug: role?.slug || "vendedor",
      };
    })
    .filter((row) => isSalesOwnerRole(row.roleSlug))
    .map((row) => ({ id: row.id, label: row.label }));

  const sales: SellerSaleRow[] = (salesResult.data || []).map((row) => ({
    salesOwnerId: (row.sales_owner_id as string | null) || null,
    salesOwnerName: profileLabel(
      row.sales_owner_profile as
        | { full_name?: string | null; email?: string | null }
        | { full_name?: string | null; email?: string | null }[]
        | null,
    ),
    paid: Number(row.paid) || 0,
    profit: Number(row.profit) || 0,
    saleKind: (row.sale_kind as string) || "full",
    createdAt: (row.created_at as string) || "",
    invoiceStatus: (row.invoice_status as string) || "open",
  }));

  return aggregateSellerMetrics({
    sales,
    owners,
    granularity: input.granularity,
    anchor,
    rangeFrom: input.rangeFrom,
    rangeTo: input.rangeTo,
  });
}
