"use server";

import { requireAppSession } from "@/lib/auth/session";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import {
  loadSellerMetricsForSession,
  type SellerMetricsReport,
} from "@/lib/seller-metrics/summary";
import {
  loadSellerSalesDetailForSession,
  type SellerSalesDetailReport,
} from "@/lib/seller-metrics/seller-sales-detail";
import type { PeriodGranularity } from "@/lib/seller-metrics/period-buckets";

export type { SellerMetricsReport } from "@/lib/seller-metrics/summary";
export type { SellerSalesDetailReport } from "@/lib/seller-metrics/seller-sales-detail";

export async function getSellerMetricsAction(input: {
  granularity: PeriodGranularity;
  anchorDate?: string | null;
  rangeFrom?: string | null;
  rangeTo?: string | null;
}): Promise<ActionResult<SellerMetricsReport>> {
  try {
    const session = await requireAppSession();
    const data = await loadSellerMetricsForSession(session, input);
    return ok(data);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function getSellerSalesDetailAction(input: {
  salesOwnerId: string;
  sellerName: string;
  granularity: PeriodGranularity;
  anchorDate?: string | null;
  rangeFrom?: string | null;
  rangeTo?: string | null;
}): Promise<ActionResult<SellerSalesDetailReport>> {
  try {
    const session = await requireAppSession();
    const data = await loadSellerSalesDetailForSession(session, input);
    return ok(data);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
