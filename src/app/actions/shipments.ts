"use server";

import { requireAppSession } from "@/lib/auth/session";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";

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

    const supabase = await createSupabaseServerClient();
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

export async function updateShipmentStatusAction(
  shipmentId: string,
  status: ShipmentStatus,
): Promise<ActionResult<ShipmentRow>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "routes.update_status")) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createSupabaseServerClient();
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

    return ok(data as ShipmentRow);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
