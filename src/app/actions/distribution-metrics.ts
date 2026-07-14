"use server";

import { requireAppSession } from "@/lib/auth/session";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import { loadDistributionMetricsForSession, type DistributionMetricsReport } from "@/lib/distribution/metrics";
import type { PeriodGranularity } from "@/lib/seller-metrics/period-buckets";

export type { DistributionMetricsReport } from "@/lib/distribution/metrics";

export async function getDistributionMetricsAction(input: { granularity: PeriodGranularity; anchorDate?: string | null; rangeFrom?: string | null; rangeTo?: string | null }): Promise<ActionResult<DistributionMetricsReport>> {
  try { return ok(await loadDistributionMetricsForSession(await requireAppSession(), input)); } catch (error) { return fail(actionErrorMessage(error)); }
}
