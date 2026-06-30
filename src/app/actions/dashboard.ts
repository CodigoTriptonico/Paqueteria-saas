"use server";

import { requireAppSession } from "@/lib/auth/session";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import {
  loadDashboardSummaryForSession,
  type DashboardSummary,
} from "@/lib/dashboard/summary";

export type { DashboardSummary } from "@/lib/dashboard/summary";

export async function getDashboardSummaryAction(): Promise<ActionResult<DashboardSummary>> {
  try {
    const session = await requireAppSession();
    const data = await loadDashboardSummaryForSession(session);
    return ok(data);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
