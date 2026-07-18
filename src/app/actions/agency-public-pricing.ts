"use server";

import { randomUUID } from "node:crypto";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import { validateAgencyRateDraft, type AgencyRateDraftLine } from "@/lib/agency-rate-admin";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { requireAppSession } from "@/lib/auth/session";
import { createScopedSupabase } from "@/lib/supabase/scoped";

export type AgencyPublicPriceLine = {
  destinationCode: string;
  destinationName: string;
  productCode: string;
  productName: string;
  matrixRateCents: number;
  publicPriceCents: number;
};

export type AgencyPublicPriceWorkspace = {
  agencyName: string;
  canManage: boolean;
  internalRateVersion: { id: string; version: number; validFrom: string } | null;
  publicPriceVersion: { id: string; version: number; validFrom: string } | null;
  catalog: AgencyPublicPriceLine[];
};

type WorkspaceRpcData = Omit<AgencyPublicPriceWorkspace, "catalog"> & {
  catalog: Array<Omit<AgencyPublicPriceLine, "matrixRateCents" | "publicPriceCents"> & { matrixRateCents: number | string; publicPriceCents: number | string }>;
};

export async function loadAgencyPublicPriceWorkspaceAction(): Promise<ActionResult<AgencyPublicPriceWorkspace>> {
  try {
    const session = await requireAppSession();
    if (!sessionHasPermission(session, "agency.pricing.view")) throw new Error("FORBIDDEN");
    const db = await createScopedSupabase(session);
    if (!db) throw new Error("Supabase no configurado");
    const { data, error } = await db.rpc("load_agency_public_price_workspace");
    if (error || !data) throw new Error(error?.message || "No se pudieron cargar los precios");
    const result = data as WorkspaceRpcData;
    return ok({
      ...result,
      canManage: Boolean(result.canManage),
      internalRateVersion: result.internalRateVersion ? { ...result.internalRateVersion, version: Number(result.internalRateVersion.version) } : null,
      publicPriceVersion: result.publicPriceVersion ? { ...result.publicPriceVersion, version: Number(result.publicPriceVersion.version) } : null,
      catalog: (result.catalog || []).map((line) => ({
        ...line,
        matrixRateCents: Number(line.matrixRateCents) || 0,
        publicPriceCents: Number(line.publicPriceCents) || 0,
      })),
    });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function saveAgencyPublicPricesAction(lines: AgencyRateDraftLine[]): Promise<ActionResult<{ linesSaved: number; version: number }>> {
  try {
    const session = await requireAppSession();
    if (!sessionHasPermission(session, "agency.pricing.manage")) throw new Error("FORBIDDEN");
    validateAgencyRateDraft(lines);
    const db = await createScopedSupabase(session);
    if (!db) throw new Error("Supabase no configurado");
    const { data, error } = await db.rpc("save_agency_public_prices", {
      price_lines: lines,
      idempotency_key: randomUUID(),
    });
    if (error || !data) throw new Error(error?.message || "No se pudieron guardar los precios");
    const entities = data.entities as { linesSaved?: number } | undefined;
    return ok({ linesSaved: Number(entities?.linesSaved) || 0, version: Number(data.version) || 0 });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
