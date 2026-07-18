"use server";

import { randomUUID } from "node:crypto";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { requireAppSession } from "@/lib/auth/session";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AgencyBoxBalance = {
  id: string;
  inventoryItemId: string;
  productKey: string;
  boxSize: string;
  deliveredQuantity: number;
  allocatedQuantity: number;
  availableQuantity: number;
};

export type AgencyBoxCatalogItem = {
  inventoryItemId: string;
  warehouseId: string;
  label: string;
  productKey: string;
  boxSize: string;
  availableQuantity: number;
};

type AgencyRequestLine = {
  id: string;
  serviceKind: "empty_box_delivery" | "full_box_pickup";
  requestedQuantity: number;
  confirmedQuantity: number | null;
  productKey: string;
  boxSize: string;
};

export type AgencyRequest = {
  id: string;
  code: string;
  status: string;
  requestedServiceDate: string | null;
  notes: string;
  createdAt: string;
  lines: AgencyRequestLine[];
};

export type LogisticsAgencyRequest = AgencyRequest & {
  agencyId: string;
  agencyName: string;
  defaultRouteTemplateId: string | null;
};

type AgencyRequestDbRow = {
  id: string;
  code: string;
  status: string;
  requested_service_date: string | null;
  notes: string | null;
  created_at: string;
  agency_id: string;
  agency_service_request_lines: Array<{
    id: string;
    service_kind: "empty_box_delivery" | "full_box_pickup";
    requested_quantity: number;
    confirmed_quantity: number | null;
    product_key: string | null;
    box_size: string | null;
  }> | null;
};

function mapRequest(row: AgencyRequestDbRow): AgencyRequest {
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    requestedServiceDate: row.requested_service_date,
    notes: row.notes || "",
    createdAt: row.created_at,
    lines: (row.agency_service_request_lines || []).map((line) => ({
      id: line.id,
      serviceKind: line.service_kind,
      requestedQuantity: Number(line.requested_quantity),
      confirmedQuantity: line.confirmed_quantity === null ? null : Number(line.confirmed_quantity),
      productKey: line.product_key || "",
      boxSize: line.box_size || "",
    })),
  };
}

export async function loadAgencyBoxInventoryAction(): Promise<ActionResult<AgencyBoxBalance[]>> {
  try {
    const session = await requireAppSession();
    const db = await createScopedSupabase(session);
    if (!db) throw new Error("Supabase no configurado");
    const { data, error } = await db
      .from("agency_box_lot_balances")
      .select("id, inventory_item_id, product_key, box_size, delivered_quantity, allocated_quantity, available_quantity")
      .eq("organization_id", session.organizationId)
      .order("product_key");
    if (error) throw new Error(error.message);
    return ok((data || []).map((row) => ({
      id: row.id,
      inventoryItemId: row.inventory_item_id,
      productKey: row.product_key || "",
      boxSize: row.box_size || "",
      deliveredQuantity: Number(row.delivered_quantity) || 0,
      allocatedQuantity: Number(row.allocated_quantity) || 0,
      availableQuantity: Number(row.available_quantity) || 0,
    })));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function loadAgencyDeliveryCatalogAction(): Promise<ActionResult<AgencyBoxCatalogItem[]>> {
  try {
    const session = await requireAppSession();
    if (!sessionHasPermission(session, "agency.requests.create")) throw new Error("FORBIDDEN");
    const admin = createSupabaseAdminClient();
    if (!admin) throw new Error("Supabase no configurado");
    const { data: agency, error: agencyError } = await admin
      .from("agencies")
      .select("matrix_organization_id")
      .eq("organization_id", session.organizationId)
      .is("archived_at", null)
      .maybeSingle();
    if (agencyError || !agency?.matrix_organization_id) throw new Error(agencyError?.message || "No se encontró la matriz de la agencia");
    const { data: stockRows, error: stockError } = await admin
      .from("inventory_stock")
      .select("item_id, warehouse_id, stock, reserved")
      .eq("organization_id", agency.matrix_organization_id)
      .gt("stock", 0);
    if (stockError) throw new Error(stockError.message);
    const itemIds = [...new Set((stockRows || []).map((row) => row.item_id))];
    if (!itemIds.length) return ok([]);
    const { data: items, error: itemError } = await admin
      .from("inventory_items")
      .select("id, name, subcategory, size")
      .eq("organization_id", agency.matrix_organization_id)
      .in("id", itemIds);
    if (itemError) throw new Error(itemError.message);
    const itemById = new Map((items || []).map((item) => [item.id, item]));
    return ok((stockRows || []).flatMap((stock) => {
      const item = itemById.get(stock.item_id);
      const availableQuantity = Math.max(0, Number(stock.stock) - Number(stock.reserved));
      if (!item || availableQuantity < 1) return [];
      const productKey = item.subcategory || item.name;
      const boxSize = item.size || "Estándar";
      return [{ inventoryItemId: item.id, warehouseId: stock.warehouse_id, productKey, boxSize, availableQuantity, label: `${productKey} · ${boxSize}` }];
    }));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function listAgencyRequestsAction(): Promise<ActionResult<AgencyRequest[]>> {
  try {
    const session = await requireAppSession();
    const db = await createScopedSupabase(session);
    if (!db) throw new Error("Supabase no configurado");
    const { data, error } = await db
      .from("agency_service_requests")
      .select("id, code, status, requested_service_date, notes, created_at, agency_id, agency_service_request_lines(id, service_kind, requested_quantity, confirmed_quantity, product_key, box_size)")
      .eq("organization_id", session.organizationId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ok((data as AgencyRequestDbRow[] || []).map(mapRequest));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function createAgencyBoxRequestAction(input: {
  lines: Array<{ serviceKind: "empty_box_delivery" | "full_box_pickup"; quantity: number; productKey: string; boxSize: string; inventoryItemId?: string; warehouseId?: string }>;
  requestedDate?: string;
  note?: string;
}): Promise<ActionResult<{ requestId: string }>> {
  try {
    const session = await requireAppSession();
    if (!sessionHasPermission(session, "agency.requests.create")) throw new Error("FORBIDDEN");
    const db = await createScopedSupabase(session);
    if (!db) throw new Error("Supabase no configurado");
    const lines = input.lines.filter((line) => Number.isSafeInteger(line.quantity) && line.quantity > 0);
    if (!lines.length) return fail("Agrega al menos una caja con cantidad válida");
    const { data, error } = await db.rpc("create_agency_service_request", {
      lines: lines.map((line) => ({ serviceKind: line.serviceKind, quantity: line.quantity, productKey: line.productKey.trim(), boxSize: line.boxSize.trim(), inventoryItemId: line.inventoryItemId || "", warehouseId: line.warehouseId || "" })),
      requested_date: input.requestedDate || null,
      note: input.note || "",
      idempotency_key: randomUUID(),
    });
    if (error || !data?.requestId) throw new Error(error?.message || "No se pudo crear la solicitud");
    return ok({ requestId: data.requestId as string });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function listLogisticsAgencyRequestsAction(): Promise<ActionResult<LogisticsAgencyRequest[]>> {
  try {
    const session = await requireAppSession();
    if (!sessionHasPermission(session, "agency.requests.assign")) throw new Error("FORBIDDEN");
    const db = await createScopedSupabase(session);
    if (!db) throw new Error("Supabase no configurado");
    const { data, error } = await db
      .from("agency_service_requests")
      .select("id, code, status, requested_service_date, notes, created_at, agency_id, agency_service_request_lines(id, service_kind, requested_quantity, confirmed_quantity, product_key, box_size), agencies!inner(id, organizations!agencies_organization_id_fkey(name))")
      .in("status", ["submitted", "under_review", "confirmed", "scheduled"])
      .order("created_at");
    if (error) throw new Error(error.message);
    return ok((data || []).map((row) => {
      const request = mapRequest(row as AgencyRequestDbRow);
      const agency = Array.isArray((row as { agencies?: unknown }).agencies) ? (row as { agencies: unknown[] }).agencies[0] : (row as { agencies?: unknown }).agencies;
      const agencyName = typeof agency === "object" && agency && "organizations" in agency
        ? String((agency as { organizations?: { name?: string } | { name?: string }[] }).organizations instanceof Array ? (agency as { organizations: { name?: string }[] }).organizations[0]?.name : (agency as { organizations?: { name?: string } }).organizations?.name || "Agencia")
        : "Agencia";
      return { ...request, agencyId: request.id ? (row as AgencyRequestDbRow).agency_id : "", agencyName, defaultRouteTemplateId: null };
    }));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function assignAgencyRequestToRouteAction(input: { requestId: string; routeId: string; scheduledFor?: string }): Promise<ActionResult<{ visitId: string }>> {
  try {
    const session = await requireAppSession();
    if (!sessionHasPermission(session, "agency.requests.assign")) throw new Error("FORBIDDEN");
    const db = await createScopedSupabase(session);
    if (!db) throw new Error("Supabase no configurado");
    const { data, error } = await db.rpc("assign_agency_request_to_route", {
      target_request_id: input.requestId,
      target_route_id: input.routeId,
      scheduled_for_value: input.scheduledFor || null,
      idempotency_key: randomUUID(),
    });
    if (error || !data?.visitId) throw new Error(error?.message || "No se pudo asignar la visita");
    return ok({ visitId: data.visitId as string });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export type AgencyDriverVisit = {
  id: string;
  agencyName: string;
  routeName: string;
  address: string;
  lines: Array<{ id: string; label: string; requestedQuantity: number }>;
  charges: Array<{ id: string; label: string; outstandingCents: number }>;
};

export async function listConductorAgencyVisitsAction(driverId: string): Promise<ActionResult<AgencyDriverVisit[]>> {
  try {
    const session = await requireAppSession();
    if (session.roleSlug === "conductor" && session.userId !== driverId) throw new Error("FORBIDDEN");
    const admin = createSupabaseAdminClient();
    if (!admin) throw new Error("Supabase no configurado");
    const { data: routes, error: routeError } = await admin.from("logistics_routes").select("id, name").eq("organization_id", session.organizationId).eq("assigned_to", driverId).not("status", "in", "(cancelled,completed)");
    if (routeError) throw new Error(routeError.message);
    const routeById = new Map((routes || []).map((route) => [route.id, route.name]));
    if (!routeById.size) return ok([]);
    const { data: visits, error } = await admin
      .from("agency_visits")
      .select("id, route_id, organization_id, address_snapshot, agencies!inner(organizations!agencies_organization_id_fkey(name)), agency_visit_lines(id, requested_quantity, agency_service_request_lines(service_kind, product_key, box_size))")
      .in("route_id", [...routeById.keys()])
      .in("status", ["assigned", "in_route", "scheduled"]);
    if (error) throw new Error(error.message);
    const organizationIds = [...new Set((visits || []).map((visit) => visit.organization_id))];
    const { data: balances } = organizationIds.length ? await admin.from("agency_charge_balances").select("charge_id, agency_organization_id, outstanding_cents").in("agency_organization_id", organizationIds).gt("outstanding_cents", 0) : { data: [] };
    return ok((visits || []).map((visit) => {
      const agency = Array.isArray(visit.agencies) ? visit.agencies[0] : visit.agencies;
      const organizations = agency && "organizations" in agency ? (Array.isArray(agency.organizations) ? agency.organizations[0] : agency.organizations) : null;
      return {
        id: visit.id,
        agencyName: organizations?.name || "Agencia",
        routeName: routeById.get(visit.route_id) || "Ruta asignada",
        address: typeof visit.address_snapshot === "object" && visit.address_snapshot ? String((visit.address_snapshot as { formattedAddress?: string; address?: string }).formattedAddress || (visit.address_snapshot as { address?: string }).address || "Dirección registrada") : "Dirección registrada",
        lines: (visit.agency_visit_lines || []).map((line) => {
          const requestLine = Array.isArray(line.agency_service_request_lines) ? line.agency_service_request_lines[0] : line.agency_service_request_lines;
          return { id: line.id, requestedQuantity: Number(line.requested_quantity), label: `${requestLine?.service_kind === "empty_box_delivery" ? "Entregar" : "Recoger"} ${requestLine?.product_key || "cajas"} ${requestLine?.box_size || ""}`.trim() };
        }),
        charges: (balances || []).filter((balance) => balance.agency_organization_id === visit.organization_id).map((balance) => ({ id: balance.charge_id, label: "Cargo pendiente", outstandingCents: Number(balance.outstanding_cents) })),
      };
    }));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function completeConductorAgencyVisitAction(input: { visitId: string; lines: Array<{ visitLineId: string; confirmedQuantity: number; differenceReason?: string }>; payment?: { amountCents: number; method: string; reference?: string; applications: Array<{ chargeId: string; amountCents: number }> } }): Promise<ActionResult<{ paymentId: string | null }>> {
  try {
    const session = await requireAppSession();
    if (session.roleSlug !== "conductor") throw new Error("FORBIDDEN");
    const db = await createScopedSupabase(session);
    if (!db) throw new Error("Supabase no configurado");
    const { data, error } = await db.rpc("complete_agency_visit_by_driver", {
      target_visit_id: input.visitId,
      line_confirmations: input.lines,
      confirmation_reason: "Confirmada por conductor",
      payment: input.payment && input.payment.amountCents > 0 ? { amountCents: input.payment.amountCents, method: input.payment.method, reference: input.payment.reference || "", applications: input.payment.applications } : null,
      idempotency_key: randomUUID(),
    });
    if (error) throw new Error(error.message);
    return ok({ paymentId: (data?.paymentId as string | null | undefined) || null });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
