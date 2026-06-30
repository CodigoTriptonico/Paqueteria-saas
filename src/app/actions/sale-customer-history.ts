"use server";

import { requireAppSession } from "@/lib/auth/session";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";

export type ShipmentSaleKind = "full" | "empty_box_deposit";

export type CustomerSaleHistoryRow = {
  id: string;
  code: string;
  country: string;
  carrier: string;
  paid: number;
  status: string;
  createdAt: string;
  saleKind: ShipmentSaleKind;
  deliveryNotes: string;
  recipientName: string | null;
};

type ShipmentHistoryDbRow = {
  id: string;
  code: string;
  country: string;
  carrier: string;
  paid: number;
  status: string;
  created_at: string;
  sale_kind?: string | null;
  delivery_notes?: string | null;
  recipient_id?: string | null;
  recipient_snapshot?: {
    firstName?: string;
    lastName?: string;
  } | null;
};

function canViewCustomerHistory(session: Awaited<ReturnType<typeof requireAppSession>>) {
  return (
    sessionHasPermission(session, "sales.manage") ||
    sessionHasPermission(session, "customers.manage")
  );
}

function recipientNameFromSnapshot(snapshot: ShipmentHistoryDbRow["recipient_snapshot"]) {
  if (!snapshot) {
    return null;
  }

  const name = [snapshot.firstName, snapshot.lastName].filter(Boolean).join(" ").trim();
  return name || null;
}

function resolveSaleKind(row: ShipmentHistoryDbRow): ShipmentSaleKind {
  if (row.sale_kind === "empty_box_deposit") {
    return "empty_box_deposit";
  }

  if (!row.recipient_id) {
    return "empty_box_deposit";
  }

  return "full";
}

export async function listCustomerSaleHistoryAction(input: {
  customerId?: string;
  recipientId?: string;
  limit?: number;
}): Promise<ActionResult<CustomerSaleHistoryRow[]>> {
  try {
    const session = await requireAppSession();

    if (!canViewCustomerHistory(session)) {
      throw new Error("FORBIDDEN");
    }

    if (!input.customerId && !input.recipientId) {
      return ok([]);
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    let query = supabase
      .from("shipments")
      .select(
        "id, code, country, carrier, paid, status, created_at, sale_kind, delivery_notes, recipient_id, recipient_snapshot",
      )
      .eq("organization_id", session.organizationId)
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(input.limit ?? 30, 1), 60));

    if (input.customerId) {
      query = query.eq("customer_id", input.customerId);
    }

    if (input.recipientId) {
      query = query.eq("recipient_id", input.recipientId);
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === "42P01" || error.code === "42703") {
        return ok([]);
      }
      return fail(error.message);
    }

    return ok(
      ((data || []) as ShipmentHistoryDbRow[]).map((row) => ({
        id: row.id,
        code: row.code,
        country: row.country,
        carrier: row.carrier,
        paid: Number(row.paid) || 0,
        status: row.status,
        createdAt: row.created_at,
        saleKind: resolveSaleKind(row),
        deliveryNotes: row.delivery_notes || "",
        recipientName: recipientNameFromSnapshot(row.recipient_snapshot),
      })),
    );
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
