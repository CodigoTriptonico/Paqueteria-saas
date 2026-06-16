"use server";

import { requireAppSession } from "@/lib/auth/session";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import { recordActivityHistory } from "@/lib/activity-history";

export type ShipmentStatus =
  | "Pendiente"
  | "En oficina"
  | "Pickup"
  | "Enviado"
  | "Entregado";

export type ShipmentRow = {
  id: string;
  code: string;
  customer_name: string;
  country: string;
  carrier: string;
  paid: number;
  profit: number;
  status: ShipmentStatus;
  assigned_to: string | null;
};

export async function listShipmentsAction(): Promise<ActionResult<ShipmentRow[]>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "routes.view")) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    let query = supabase
      .from("shipments")
      .select("id, code, customer_name, country, carrier, paid, profit, status, assigned_to")
      .eq("organization_id", session.organizationId)
      .order("created_at", { ascending: false });

    if (session.roleSlug === "conductor") {
      query = query.eq("assigned_to", session.userId);
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === "42P01") {
        return ok([]);
      }
      return fail(error.message);
    }

    return ok((data || []) as ShipmentRow[]);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

function parseMoney(value: string) {
  return Number(value.replace(/[^\d.-]/g, "")) || 0;
}

export async function createShipmentAction(input: {
  invoiceNumber: string;
  customerId?: string;
  recipientId?: string;
  customerName: string;
  country: string;
  carrier: string;
  paid: string;
  cost: string;
  recipientSnapshot?: Record<string, unknown>;
}): Promise<ActionResult<ShipmentRow>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "sales.manage")) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const paid = parseMoney(input.paid);
    const cost = parseMoney(input.cost);

    const { data, error } = await supabase
      .from("shipments")
      .insert({
        organization_id: session.organizationId,
        code: input.invoiceNumber,
        customer_name: input.customerName,
        country: input.country,
        carrier: input.carrier || "Sin carrier",
        paid,
        profit: Math.max(paid - cost, 0),
        status: "Pendiente",
        customer_id: input.customerId || null,
        recipient_id: input.recipientId || null,
        recipient_snapshot: input.recipientSnapshot || null,
      })
      .select("id, code, customer_name, country, carrier, paid, profit, status, assigned_to")
      .single();

    if (error || !data) {
      return fail(error?.message || "No se pudo registrar el envio");
    }

    await recordActivityHistory(supabase, session, {
      action: "sale.created",
      entityType: "shipment",
      entityId: data.id,
      title: `Venta registrada: ${input.invoiceNumber}`,
      description: `${input.customerName} · ${input.country} · ${input.carrier || "Sin carrier"}`,
      metadata: {
        paid,
        cost,
        profit: Math.max(paid - cost, 0),
        customerId: input.customerId || null,
        recipientId: input.recipientId || null,
      },
    });

    return ok(data as ShipmentRow);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function updateShipmentStatusAction(
  shipmentId: string,
  status: ShipmentStatus,
): Promise<ActionResult<ShipmentRow>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "routes.update_status")) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    let query = supabase
      .from("shipments")
      .update({ status })
      .eq("id", shipmentId)
      .eq("organization_id", session.organizationId);

    if (session.roleSlug === "conductor") {
      query = query.eq("assigned_to", session.userId);
    }

    const { data, error } = await query
      .select("id, code, customer_name, country, carrier, paid, profit, status, assigned_to")
      .single();

    if (error || !data) {
      return fail(error?.message || "Envio no encontrado");
    }

    await recordActivityHistory(supabase, session, {
      action: "shipment.status_updated",
      entityType: "shipment",
      entityId: data.id,
      title: `Envio ${data.code}: ${status}`,
      description: `${data.customer_name} · ${data.country}`,
    });

    return ok(data as ShipmentRow);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
