"use server";

import { randomUUID } from "node:crypto";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import { validateAgencyRateDraft, type AgencyRateDraftLine } from "@/lib/agency-rate-admin";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { requireAppSession } from "@/lib/auth/session";
import { createScopedSupabase } from "@/lib/supabase/scoped";

export type AgencyRateCatalogLine = {
  destinationCode: string;
  destinationName: string;
  productCode: string;
  productName: string;
  amountCents: number;
};

export type AgencyRateAdminData = {
  agency: { id: string; organizationId: string; code: string; name: string; status: string; balanceCents: number };
  version: { id: string; version: number; validFrom: string } | null;
  catalog: AgencyRateCatalogLine[];
};

type RateAdminRpcData = Omit<AgencyRateAdminData, "catalog"> & {
  catalog: Array<Omit<AgencyRateCatalogLine, "amountCents"> & { amountCents: number | string }>;
};

export async function loadAgencyInternalRateAdminAction(agencyId: string): Promise<ActionResult<AgencyRateAdminData>> {
  try {
    const session = await requireAppSession();
    if (!sessionHasPermission(session, "agency.pricing.manage")) throw new Error("FORBIDDEN");
    const db = await createScopedSupabase(session);
    if (!db) throw new Error("Supabase no configurado");
    const { data, error } = await db.rpc("load_agency_internal_rate_admin", { target_agency_id: agencyId });
    if (error || !data) throw new Error(error?.message || "No se pudo cargar la tarifa de la agencia");
    const result = data as RateAdminRpcData;
    return ok({
      ...result,
      agency: { ...result.agency, balanceCents: Number(result.agency.balanceCents) || 0 },
      version: result.version ? { ...result.version, version: Number(result.version.version) } : null,
      catalog: (result.catalog || []).map((line) => ({ ...line, amountCents: Number(line.amountCents) || 0 })),
    });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function saveAgencyInternalRatesAction(input: { agencyId: string; lines: AgencyRateDraftLine[] }): Promise<ActionResult<{ linesSaved: number; version: number }>> {
  try {
    const session = await requireAppSession();
    if (!sessionHasPermission(session, "agency.pricing.manage")) throw new Error("FORBIDDEN");
    validateAgencyRateDraft(input.lines);
    const db = await createScopedSupabase(session);
    if (!db) throw new Error("Supabase no configurado");
    const { data, error } = await db.rpc("save_agency_internal_rates", {
      target_agency_id: input.agencyId,
      rate_lines: input.lines,
      idempotency_key: randomUUID(),
    });
    if (error || !data) throw new Error(error?.message || "No se pudo guardar la tarifa");
    const entities = data.entities as { linesSaved?: number } | undefined;
    return ok({ linesSaved: Number(entities?.linesSaved) || 0, version: Number(data.version) || 0 });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
