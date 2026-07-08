"use server";

import { requireAppSession } from "@/lib/auth/session";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import {
  canReadPricingSession,
  canWritePricingSession,
  loadPricingConfigForSession,
} from "@/lib/pricing/load-config";
import {
  saleCountryBoxesFromCountries,
  saleLogisticsFeesFromRouteConfig,
  salePricingFromConfig,
} from "@/lib/pricing/sale-derivatives";
import type { SaleLogisticsFeesPayload, SalePricingPayload } from "@/lib/pricing/sale-derivatives";
import type { PricingConfigPayload } from "@/lib/pricing/types";
import { buildPricingRpcPayload } from "@/lib/pricing/rpc-payload";

export type {
  PricingBoxConfig,
  PricingConfigPayload,
  PricingCountryConfig,
  PricingDistributorConfig,
  PricingDistributorPrices,
  PricingRouteConfig,
} from "@/lib/pricing/types";
export type { SaleLogisticsFeesPayload, SalePricingPayload } from "@/lib/pricing/sale-derivatives";

export async function loadPricingConfigAction(): Promise<ActionResult<PricingConfigPayload>> {
  try {
    const session = await requireAppSession();
    const data = await loadPricingConfigForSession(session);
    return ok(data);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function savePricingConfigAction(
  payload: PricingConfigPayload,
): Promise<ActionResult<null>> {
  try {
    const session = await requireAppSession();

    if (!canWritePricingSession(session)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const orgId = session.organizationId;
    const rpcPayload = buildPricingRpcPayload(payload);

    const { error: rpcError } = await supabase.rpc("replace_pricing_config", {
      target_org_id: orgId,
      payload: rpcPayload,
    });

    if (rpcError) {
      return fail(rpcError.message);
    }

    return ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

/** Cajas por pais para venta: [tamano, precio, costo, carrier, tiempo, catalogKey] */
export async function loadSaleCountryBoxesAction(): Promise<
  ActionResult<Record<string, string[][]>>
> {
  try {
    const session = await requireAppSession();

    if (!canReadPricingSession(session)) {
      throw new Error("FORBIDDEN");
    }

    const config = await loadPricingConfigForSession(session);
    return ok(saleCountryBoxesFromCountries(config.countries));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function loadSalePricingAction(): Promise<ActionResult<SalePricingPayload>> {
  try {
    const session = await requireAppSession();

    if (!canReadPricingSession(session)) {
      throw new Error("FORBIDDEN");
    }

    const config = await loadPricingConfigForSession(session);
    return ok(salePricingFromConfig(config.countries, config.promotions));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function loadSaleLogisticsFeesAction(): Promise<
  ActionResult<SaleLogisticsFeesPayload>
> {
  try {
    const session = await requireAppSession();

    if (!canReadPricingSession(session)) {
      throw new Error("FORBIDDEN");
    }

    const config = await loadPricingConfigForSession(session);
    return ok(saleLogisticsFeesFromRouteConfig(config.routeConfig));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function allocateInvoiceNumberAction(): Promise<ActionResult<{ invoiceNumber: string }>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "sales.manage")) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data, error } = await supabase.rpc("next_organization_invoice_number", {
      target_org_id: session.organizationId,
    });

    if (error) {
      return fail(error.message);
    }

    const sequence = Number(data) || 1;
    const invoiceNumber = `INV-${String(sequence).padStart(6, "0")}`;

    return ok({ invoiceNumber });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
