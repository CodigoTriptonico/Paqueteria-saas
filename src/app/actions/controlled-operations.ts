"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { requireAppSession } from "@/lib/auth/session";
import type { PermissionKey } from "@/lib/auth/types";
import type { CustodyHolderType, OperationalExceptionType } from "@/lib/controlled-operations";
import type { PackageCustodyEventType } from "@/lib/package-custody";
import { createScopedSupabase } from "@/lib/supabase/scoped";

export type ControlledHandoff = {
  id: string;
  packageCode: string;
  fromLabel: string;
  toLabel: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  initiatedAt: string;
  receivedAt: string | null;
};

export type ControlledException = {
  id: string;
  packageCode: string;
  type: OperationalExceptionType;
  status: string;
  reason: string;
  reportedAt: string;
  blocksRelease: boolean;
};

export type ControlledCustodyEvent = {
  id: string;
  type: PackageCustodyEventType;
  fromLabel: string;
  toLabel: string;
  occurredAt: string;
  actorName: string;
};

export type ControlledPackageCustody = {
  packageId: string;
  packageCode: string;
  holderLabel: string;
  holderType: string;
  status: string;
  since: string;
  history: ControlledCustodyEvent[];
};

export type AgencyDailyClose = {
  id: string;
  operatingDate: string;
  timezone: string;
  status: "prepared" | "closed";
  expectedCashCents: number;
  countedCashCents: number;
  differenceCents: number;
  differenceReason: string;
  summary: Record<string, number>;
  preparedAt: string;
  finalizedAt: string | null;
};

function can(session: Awaited<ReturnType<typeof requireAppSession>>, permission: PermissionKey) {
  return sessionHasPermission(session, permission);
}

function controlledError(error: unknown) {
  return actionErrorMessage(error);
}

export async function loadControlledOperationsAction(packageId?: string): Promise<ActionResult<{
  handoffs: ControlledHandoff[];
  exceptions: ControlledException[];
  custody: ControlledPackageCustody[];
}>> {
  try {
    const session = await requireAppSession();
    if (!can(session, "package.custody.view") && !can(session, "exceptions.report")) throw new Error("FORBIDDEN");
    const db = await createScopedSupabase(session);
    if (!db) throw new Error("Supabase no configurado");
    let handoffQuery = db
      .from("package_custody_handoffs")
      .select("id, from_holder_label, to_holder_label, status, initiated_at, received_at, shipment_packages(code)")
      .eq("organization_id", session.organizationId)
      .order("initiated_at", { ascending: false })
      .limit(100);
    let exceptionQuery = db
      .from("operational_exceptions")
      .select("id, exception_type, status, reason, reported_at, blocks_release, shipment_packages(code)")
      .eq("organization_id", session.organizationId)
      .order("reported_at", { ascending: false })
      .limit(100);
    let currentCustodyQuery = db
      .from("package_custody_current")
      .select("package_id, holder_type, holder_label, package_status, occurred_at, shipment_packages(code)")
      .eq("organization_id", session.organizationId);
    let custodyQuery = db
      .from("package_custody_events")
      .select("id, package_id, event_type, from_holder_label, to_holder_label, package_status, occurred_at, shipment_packages(code), actor:profiles!package_custody_events_actor_id_fkey(full_name, email)")
      .eq("organization_id", session.organizationId)
      .order("occurred_at", { ascending: false })
      .order("created_at", { ascending: false });
    if (packageId) {
      handoffQuery = handoffQuery.eq("package_id", packageId);
      exceptionQuery = exceptionQuery.eq("package_id", packageId);
      custodyQuery = custodyQuery.eq("package_id", packageId);
      currentCustodyQuery = currentCustodyQuery.eq("package_id", packageId);
    } else {
      custodyQuery = custodyQuery.limit(500);
    }
    const [{ data: handoffs, error: handoffError }, { data: exceptions, error: exceptionError }, { data: currentCustodyRows, error: currentCustodyError }, { data: custodyRows, error: custodyError }] = await Promise.all([handoffQuery, exceptionQuery, currentCustodyQuery, custodyQuery]);
    if (handoffError || exceptionError || currentCustodyError || custodyError) throw new Error(handoffError?.message || exceptionError?.message || currentCustodyError?.message || custodyError?.message);
    const custodyByPackage = new Map<string, ControlledPackageCustody>();
    for (const row of currentCustodyRows || []) {
      const packageRow = Array.isArray(row.shipment_packages) ? row.shipment_packages[0] : row.shipment_packages;
      custodyByPackage.set(String(row.package_id), {
        packageId: String(row.package_id),
        packageCode: String((packageRow as { code?: string } | null)?.code || "Caja"),
        holderLabel: String(row.holder_label || "Custodia sin identificar"),
        holderType: String(row.holder_type || ""),
        status: String(row.package_status || ""),
        since: String(row.occurred_at),
        history: [],
      });
    }
    for (const row of custodyRows || []) {
      const packageRow = Array.isArray(row.shipment_packages) ? row.shipment_packages[0] : row.shipment_packages;
      const actor = Array.isArray(row.actor) ? row.actor[0] : row.actor;
      const packageKey = String(row.package_id);
      const event: ControlledCustodyEvent = {
        id: String(row.id), type: row.event_type as PackageCustodyEventType,
        fromLabel: String(row.from_holder_label || ""), toLabel: String(row.to_holder_label || ""),
        occurredAt: String(row.occurred_at),
        actorName: String((actor as { full_name?: string | null; email?: string | null } | null)?.full_name || (actor as { email?: string | null } | null)?.email || "Sistema"),
      };
      const current = custodyByPackage.get(packageKey);
      if (current) { current.history.push(event); continue; }
      custodyByPackage.set(packageKey, {
        packageId: packageKey,
        packageCode: String((packageRow as { code?: string } | null)?.code || "Caja"),
        holderLabel: event.toLabel || "Custodia sin identificar",
        holderType: "",
        status: String(row.package_status || ""),
        since: event.occurredAt,
        history: [event],
      });
    }
    return ok({
      handoffs: (handoffs || []).map((row) => {
        const pkg = Array.isArray(row.shipment_packages) ? row.shipment_packages[0] : row.shipment_packages;
        return {
          id: String(row.id), packageCode: String((pkg as { code?: string } | null)?.code || "Caja"),
          fromLabel: String(row.from_holder_label || "Origen pendiente"), toLabel: String(row.to_holder_label || "Destino"),
          status: row.status as ControlledHandoff["status"], initiatedAt: String(row.initiated_at), receivedAt: row.received_at || null,
        };
      }),
      exceptions: (exceptions || []).map((row) => {
        const pkg = Array.isArray(row.shipment_packages) ? row.shipment_packages[0] : row.shipment_packages;
        return {
          id: String(row.id), packageCode: String((pkg as { code?: string } | null)?.code || "Caja"),
          type: row.exception_type as OperationalExceptionType, status: String(row.status), reason: String(row.reason),
          reportedAt: String(row.reported_at), blocksRelease: Boolean(row.blocks_release),
        };
      }),
      custody: [...custodyByPackage.values()],
    });
  } catch (error) { return fail(controlledError(error)); }
}

export async function initiatePackageCustodyHandoffAction(input: {
  packageId: string; holderType: CustodyHolderType; holderId?: string | null; holderLabel: string; reason: string;
}): Promise<ActionResult<{ handoffId: string }>> {
  try {
    const session = await requireAppSession();
    if (!can(session, "package.custody.transfer")) throw new Error("FORBIDDEN");
    const db = await createScopedSupabase(session);
    if (!db) throw new Error("Supabase no configurado");
    const { data, error } = await db.rpc("initiate_package_custody_handoff", {
      target_package_id: input.packageId, target_holder_type: input.holderType, target_holder_id: input.holderId || null,
      target_holder_label: input.holderLabel.trim(), handoff_reason: input.reason.trim(),
      handoff_evidence: { note: input.reason.trim() }, operation_key: randomUUID(),
    });
    if (error || !data) throw new Error(error?.message || "No se pudo iniciar el traspaso");
    revalidatePath("/seguimiento/excepciones"); revalidatePath("/bodega"); revalidatePath("/paletas");
    return ok({ handoffId: String((data as { handoffId?: string }).handoffId) });
  } catch (error) { return fail(controlledError(error)); }
}

export async function acceptPackageCustodyHandoffAction(handoffId: string, evidence: string): Promise<ActionResult<null>> {
  try {
    const session = await requireAppSession();
    if (!can(session, "package.custody.receive")) throw new Error("FORBIDDEN");
    const db = await createScopedSupabase(session);
    if (!db) throw new Error("Supabase no configurado");
    const { error } = await db.rpc("accept_package_custody_handoff", { target_handoff_id: handoffId, receive_evidence_value: { note: evidence.trim() }, operation_key: randomUUID() });
    if (error) throw new Error(error.message);
    revalidatePath("/seguimiento/excepciones"); revalidatePath("/bodega"); revalidatePath("/paletas");
    return ok(null);
  } catch (error) { return fail(controlledError(error)); }
}

export async function reportOperationalExceptionAction(input: {
  packageId: string; type: OperationalExceptionType; reason: string;
}): Promise<ActionResult<{ exceptionId: string }>> {
  try {
    const session = await requireAppSession();
    if (!can(session, "exceptions.report")) throw new Error("FORBIDDEN");
    const db = await createScopedSupabase(session);
    if (!db) throw new Error("Supabase no configurado");
    const { data, error } = await db.rpc("report_operational_exception", {
      target_package_id: input.packageId, target_task_id: null, exception_kind: input.type,
      exception_reason: input.reason.trim(), exception_evidence: { note: input.reason.trim() }, operation_key: randomUUID(),
    });
    if (error || !data) throw new Error(error?.message || "No se pudo reportar la excepción");
    revalidatePath("/seguimiento/excepciones"); revalidatePath("/bodega"); revalidatePath("/paletas");
    return ok({ exceptionId: String((data as { exceptionId?: string }).exceptionId) });
  } catch (error) { return fail(controlledError(error)); }
}

export async function resolveOperationalExceptionAction(exceptionId: string, resolution: string): Promise<ActionResult<null>> {
  try {
    const session = await requireAppSession();
    if (!can(session, "exceptions.resolve")) throw new Error("FORBIDDEN");
    const db = await createScopedSupabase(session);
    if (!db) throw new Error("Supabase no configurado");
    const { error } = await db.rpc("resolve_operational_exception", { target_exception_id: exceptionId, resolution_note: resolution.trim(), resolution_evidence: {} });
    if (error) throw new Error(error.message);
    revalidatePath("/seguimiento/excepciones"); return ok(null);
  } catch (error) { return fail(controlledError(error)); }
}

export async function approveOperationalExceptionAction(exceptionId: string, note = ""): Promise<ActionResult<null>> {
  try {
    const session = await requireAppSession();
    if (!can(session, "exceptions.approve")) throw new Error("FORBIDDEN");
    const db = await createScopedSupabase(session);
    if (!db) throw new Error("Supabase no configurado");
    const { error } = await db.rpc("approve_operational_exception", { target_exception_id: exceptionId, approval_note: note.trim() });
    if (error) throw new Error(error.message);
    revalidatePath("/seguimiento/excepciones"); return ok(null);
  } catch (error) { return fail(controlledError(error)); }
}

export async function loadAgencyDailyCloseAction(): Promise<ActionResult<AgencyDailyClose | null>> {
  try {
    const session = await requireAppSession();
    if (!can(session, "agency.daily_close.view") && !can(session, "agency.daily_close.prepare") && !can(session, "agency.daily_close.finalize")) throw new Error("FORBIDDEN");
    const db = await createScopedSupabase(session);
    if (!db) throw new Error("Supabase no configurado");
    const { data, error } = await db.from("agency_daily_closures").select("*").eq("organization_id", session.organizationId).order("operating_date", { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return ok(null);
    return ok({
      id: data.id, operatingDate: data.operating_date, timezone: data.timezone, status: data.status,
      expectedCashCents: Number(data.expected_cash_cents), countedCashCents: Number(data.counted_cash_cents), differenceCents: Number(data.difference_cents),
      differenceReason: data.difference_reason, summary: data.summary as Record<string, number>, preparedAt: data.prepared_at, finalizedAt: data.finalized_at,
    });
  } catch (error) { return fail(controlledError(error)); }
}

export async function prepareAgencyDailyCloseAction(input: { operatingDate: string; countedCashCents: number; differenceReason: string; timezone?: string }): Promise<ActionResult<AgencyDailyClose>> {
  try {
    const session = await requireAppSession();
    if (!can(session, "agency.daily_close.prepare")) throw new Error("FORBIDDEN");
    const db = await createScopedSupabase(session);
    if (!db) throw new Error("Supabase no configurado");
    const { data, error } = await db.rpc("prepare_agency_daily_close", {
      target_date: input.operatingDate, target_timezone: input.timezone || "America/Los_Angeles", counted_cash: Math.round(input.countedCashCents),
      close_difference_reason: input.differenceReason.trim(), operation_key: randomUUID(),
    });
    if (error || !data) throw new Error(error?.message || "No se pudo preparar el cierre");
    const value = data as Record<string, unknown>;
    revalidatePath("/agencia/cierre"); revalidatePath("/agencia");
    return ok({ id: String(value.closureId), operatingDate: input.operatingDate, timezone: input.timezone || "America/Los_Angeles", status: "prepared", expectedCashCents: Number(value.expectedCashCents), countedCashCents: Number(value.countedCashCents), differenceCents: Number(value.differenceCents), differenceReason: input.differenceReason, summary: value.summary as Record<string, number>, preparedAt: new Date().toISOString(), finalizedAt: null });
  } catch (error) { return fail(controlledError(error)); }
}

export async function finalizeAgencyDailyCloseAction(closureId: string): Promise<ActionResult<null>> {
  try {
    const session = await requireAppSession();
    if (!can(session, "agency.daily_close.finalize")) throw new Error("FORBIDDEN");
    const db = await createScopedSupabase(session);
    if (!db) throw new Error("Supabase no configurado");
    const { error } = await db.rpc("finalize_agency_daily_close", { target_closure_id: closureId });
    if (error) throw new Error(error.message);
    revalidatePath("/agencia/cierre"); revalidatePath("/agencia"); return ok(null);
  } catch (error) { return fail(controlledError(error)); }
}
