"use server";

import { requireAppSession } from "@/lib/auth/session";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";

export type ActivityHistoryRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  title: string;
  description: string;
  actorName: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};

type ActivityHistoryDbRow = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  title: string;
  description: string;
  actor_name: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

function canViewHistory(session: Awaited<ReturnType<typeof requireAppSession>>) {
  return (
    sessionHasPermission(session, "sales.manage") ||
    sessionHasPermission(session, "customers.manage") ||
    sessionHasPermission(session, "routes.view") ||
    sessionHasPermission(session, "routes.update_status") ||
    sessionHasPermission(session, "settings.manage")
  );
}

export async function listActivityHistoryAction(
  limit = 80,
): Promise<ActionResult<ActivityHistoryRow[]>> {
  try {
    const session = await requireAppSession();

    if (!canViewHistory(session)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data, error } = await supabase
      .from("activity_history")
      .select(
        "id, action, entity_type, entity_id, title, description, actor_name, created_at, metadata",
      )
      .eq("organization_id", session.organizationId)
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 200));

    if (error) {
      if (error.code === "42P01") {
        return ok([]);
      }
      return fail(error.message);
    }

    return ok(
      ((data || []) as ActivityHistoryDbRow[]).map((row) => ({
        id: row.id,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        title: row.title,
        description: row.description,
        actorName: row.actor_name,
        createdAt: row.created_at,
        metadata: row.metadata || {},
      })),
    );
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function listShipmentActivityHistoryAction(
  shipmentId: string,
  limit = 40,
): Promise<ActionResult<ActivityHistoryRow[]>> {
  try {
    const session = await requireAppSession();

    if (!canViewHistory(session)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data, error } = await supabase
      .from("activity_history")
      .select(
        "id, action, entity_type, entity_id, title, description, actor_name, created_at, metadata",
      )
      .eq("organization_id", session.organizationId)
      .eq("entity_type", "shipment")
      .eq("entity_id", shipmentId)
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 100));

    if (error) {
      if (error.code === "42P01") {
        return ok([]);
      }
      return fail(error.message);
    }

    return ok(
      ((data || []) as ActivityHistoryDbRow[]).map((row) => ({
        id: row.id,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        title: row.title,
        description: row.description,
        actorName: row.actor_name,
        createdAt: row.created_at,
        metadata: row.metadata || {},
      })),
    );
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
