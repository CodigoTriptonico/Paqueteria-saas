import type { AppSession } from "@/lib/auth/types";
import { canManageAllShipments } from "@/lib/shipment-visibility";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import {
  anchorDateKey,
  defaultRangeKeys,
  normalizeAnchorDate,
  normalizeRangeKeys,
  periodBounds,
  periodLabel,
  type PeriodGranularity,
} from "@/lib/seller-metrics/period-buckets";

export type SellerSaleDetailRow = {
  id: string;
  code: string;
  customerName: string;
  country: string;
  paid: number;
  profit: number;
  invoiceStatus: string;
  status: string;
  saleKind: string;
  createdAt: string;
  recipientName: string | null;
};

export type SellerSalesDetailTotals = {
  saleCount: number;
  openCount: number;
  closedCount: number;
  totalPaid: number;
  totalProfit: number;
  fullSales: number;
  depositSales: number;
};

export type SellerSalesDetailReport = {
  sellerId: string;
  sellerName: string;
  granularity: PeriodGranularity;
  periodLabel: string;
  anchorDate: string;
  rangeFrom: string | null;
  rangeTo: string | null;
  periodStart: string;
  periodEnd: string;
  totals: SellerSalesDetailTotals;
  sales: SellerSaleDetailRow[];
};

type SellerSaleDetailDbRow = {
  id: string;
  code: string;
  customer_name: string;
  country: string;
  paid: number | string;
  profit: number | string;
  invoice_status: string;
  status: string;
  sale_kind: string;
  created_at: string;
  recipient_snapshot?: {
    firstName?: string;
    lastName?: string;
  } | null;
};

function recipientNameFromSnapshot(
  snapshot: SellerSaleDetailDbRow["recipient_snapshot"],
) {
  if (!snapshot) {
    return null;
  }

  const name = [snapshot.firstName, snapshot.lastName].filter(Boolean).join(" ").trim();
  return name || null;
}

function isClosedSale(invoiceStatus: string) {
  return invoiceStatus === "paid";
}

export function buildSellerSalesDetailReport(input: {
  sellerId: string;
  sellerName: string;
  granularity: PeriodGranularity;
  anchor: Date;
  rangeFrom?: string | null;
  rangeTo?: string | null;
  sales: SellerSaleDetailRow[];
}): SellerSalesDetailReport {
  const anchor = normalizeAnchorDate(input.anchor);
  const rangeKeys =
    input.granularity === "range"
      ? input.rangeFrom && input.rangeTo
        ? normalizeRangeKeys(input.rangeFrom, input.rangeTo)
        : defaultRangeKeys(anchor)
      : null;
  const { start, end } = periodBounds(anchor, input.granularity, rangeKeys);

  const totals: SellerSalesDetailTotals = {
    saleCount: 0,
    openCount: 0,
    closedCount: 0,
    totalPaid: 0,
    totalProfit: 0,
    fullSales: 0,
    depositSales: 0,
  };

  for (const sale of input.sales) {
    if (sale.invoiceStatus === "void") {
      continue;
    }

    const createdAt = new Date(sale.createdAt);
    if (Number.isNaN(createdAt.getTime()) || createdAt < start || createdAt >= end) {
      continue;
    }

    totals.saleCount += 1;
    totals.totalPaid += sale.paid;
    totals.totalProfit += sale.profit;

    if (isClosedSale(sale.invoiceStatus)) {
      totals.closedCount += 1;
    } else {
      totals.openCount += 1;
    }

    if (sale.saleKind === "empty_box_deposit") {
      totals.depositSales += 1;
    } else {
      totals.fullSales += 1;
    }
  }

  const sales = [...input.sales]
    .filter((sale) => {
      if (sale.invoiceStatus === "void") {
        return false;
      }

      const createdAt = new Date(sale.createdAt);
      return !Number.isNaN(createdAt.getTime()) && createdAt >= start && createdAt < end;
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return {
    sellerId: input.sellerId,
    sellerName: input.sellerName,
    granularity: input.granularity,
    periodLabel: periodLabel(anchor, input.granularity, rangeKeys),
    anchorDate: rangeKeys?.from || anchorDateKey(anchor),
    rangeFrom: rangeKeys?.from || null,
    rangeTo: rangeKeys?.to || null,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    totals,
    sales,
  };
}

function mapSaleRow(row: SellerSaleDetailDbRow): SellerSaleDetailRow {
  return {
    id: row.id,
    code: row.code,
    customerName: row.customer_name,
    country: row.country,
    paid: Number(row.paid) || 0,
    profit: Number(row.profit) || 0,
    invoiceStatus: row.invoice_status,
    status: row.status,
    saleKind: row.sale_kind || "full",
    createdAt: row.created_at,
    recipientName: recipientNameFromSnapshot(row.recipient_snapshot),
  };
}

export async function loadSellerSalesDetailForSession(
  session: AppSession,
  input: {
    salesOwnerId: string;
    sellerName: string;
    granularity: PeriodGranularity;
    anchorDate?: string | null;
    rangeFrom?: string | null;
    rangeTo?: string | null;
  },
): Promise<SellerSalesDetailReport> {
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

  const { data, error } = await supabase
    .from("shipments")
    .select(
      "id, code, customer_name, country, paid, profit, invoice_status, status, sale_kind, created_at, recipient_snapshot",
    )
    .eq("organization_id", orgId)
    .eq("sales_owner_id", input.salesOwnerId)
    .neq("invoice_status", "void")
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const sales = (data || []).map((row) => mapSaleRow(row as SellerSaleDetailDbRow));

  return buildSellerSalesDetailReport({
    sellerId: input.salesOwnerId,
    sellerName: input.sellerName,
    granularity: input.granularity,
    anchor,
    rangeFrom: input.rangeFrom,
    rangeTo: input.rangeTo,
    sales,
  });
}
