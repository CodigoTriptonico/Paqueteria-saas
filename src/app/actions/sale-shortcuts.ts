"use server";

import { requireAppSession } from "@/lib/auth/session";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import { listSaleShortcutsForSession, type SaleShortcuts } from "@/lib/sale/shortcuts";

export type { SaleShortcuts } from "@/lib/sale/shortcuts";

export async function listSaleShortcutsAction(): Promise<ActionResult<SaleShortcuts>> {
  try {
    const session = await requireAppSession();
    const data = await listSaleShortcutsForSession(session);
    return ok(data);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
