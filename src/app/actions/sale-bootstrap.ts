"use server";

import { requireAppSession } from "@/lib/auth/session";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import { loadVentaBootstrap, type VentaBootstrapData } from "@/lib/sale/bootstrap";
import type { ListCustomersParams } from "@/lib/customers/list-params";

export type { VentaBootstrapData } from "@/lib/sale/bootstrap";

export async function loadVentaBootstrapAction(
  customerParams?: ListCustomersParams,
): Promise<ActionResult<VentaBootstrapData>> {
  try {
    const session = await requireAppSession();
    const data = await loadVentaBootstrap(session, customerParams);
    return ok(data);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
