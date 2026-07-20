"use server";

import { randomUUID } from "node:crypto";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { requireAppSession as loadAppSession } from "@/lib/auth/session";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function requireAppSession() {
  const session = await loadAppSession();
  if (!session.agencyModuleEnabled) throw new Error("FORBIDDEN");
  return session;
}

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

export type AgencyServiceCode =
  | "agency_office_empty_box_delivery"
  | "agency_office_full_box_pickup"
  | "customer_home_delivery"
  | "customer_empty_box_delivery"
  | "customer_full_box_pickup";

type AgencyRequestLine = {
  id: string;
  serviceKind: "empty_box_delivery" | "full_box_pickup" | "home_delivery" | "home_pickup";
  serviceCode: AgencyServiceCode;
  requestedQuantity: number;
  confirmedQuantity: number | null;
  productKey: string;
  boxSize: string;
  unitChargeAmountCents: number;
  priceSource: string;
};

export type AgencyRequest = {
  id: string;
  code: string;
  status: string;
  requestedServiceDate: string | null;
  notes: string;
  createdAt: string;
  requestScope: "agency_office" | "agency_customer";
  agencyCustomerId: string | null;
  address: string;
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
  request_scope: "agency_office" | "agency_customer";
  agency_customer_id: string | null;
  address_snapshot: Record<string, unknown> | null;
  agency_service_request_lines: Array<{
    id: string;
    service_kind: "empty_box_delivery" | "full_box_pickup" | "home_delivery" | "home_pickup";
    service_code: AgencyServiceCode;
    requested_quantity: number;
    confirmed_quantity: number | null;
    product_key: string | null;
    box_size: string | null;
    unit_charge_amount_cents: number | string;
    commercial_price_snapshot: Record<string, unknown> | null;
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
    requestScope: row.request_scope || "agency_office",
    agencyCustomerId: row.agency_customer_id || null,
    address: String(row.address_snapshot?.formattedAddress || row.address_snapshot?.address || ""),
    lines: (row.agency_service_request_lines || []).map((line) => ({
      id: line.id,
      serviceKind: line.service_kind,
      serviceCode: line.service_code,
      requestedQuantity: Number(line.requested_quantity),
      confirmedQuantity: line.confirmed_quantity === null ? null : Number(line.confirmed_quantity),
      productKey: line.product_key || "",
      boxSize: line.box_size || "",
      unitChargeAmountCents: Number(line.unit_charge_amount_cents) || 0,
      priceSource: String(line.commercial_price_snapshot?.sourceLevel || "country"),
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

export type AgencyRequestCustomer = {
  id: string;
  name: string;
  destinationCode: string;
  address: Record<string, unknown>;
  addressLabel: string;
};

export async function listAgencyRequestCustomersAction(): Promise<ActionResult<AgencyRequestCustomer[]>> {
  try {
    const session = await requireAppSession();
    if (!sessionHasPermission(session, "agency.requests.create")) throw new Error("FORBIDDEN");
    const db = await createScopedSupabase(session);
    if (!db) throw new Error("Supabase no configurado");
    const { data, error } = await db.from("customers")
      .select("id, first_name, last_name, country, street, house_number, neighborhood, city, state, postal_code, formatted_address, place_id, lat, lng")
      .eq("organization_id", session.organizationId).eq("is_active", true).order("first_name");
    if (error) throw new Error(error.message);
    const admin = createSupabaseAdminClient();
    const { data: agency } = admin ? await admin.from("agencies").select("matrix_organization_id").eq("organization_id", session.organizationId).maybeSingle() : { data: null };
    const { data: countries } = admin && agency?.matrix_organization_id ? await admin.from("pricing_countries").select("code, name").eq("organization_id", agency.matrix_organization_id) : { data: [] };
    const countryCode = (value: string) => (countries || []).find((country) => country.code.toLowerCase() === value.toLowerCase() || country.name.toLowerCase() === value.toLowerCase())?.code || value;
    return ok((data || []).map((row) => {
      const addressLabel = row.formatted_address || [row.street, row.house_number, row.neighborhood, row.city, row.state, row.postal_code].filter(Boolean).join(", ");
      return {
        id: row.id,
        name: `${row.first_name} ${row.last_name}`.trim(),
        destinationCode: countryCode(String(row.country || "").trim()).toUpperCase(),
        addressLabel,
        address: { formattedAddress: addressLabel, street: row.street, houseNumber: row.house_number, neighborhood: row.neighborhood, city: row.city, state: row.state, postalCode: row.postal_code, country: row.country, placeId: row.place_id, lat: row.lat, lng: row.lng },
      };
    }));
  } catch (error) { return fail(actionErrorMessage(error)); }
}

export async function listAgencyRequestsAction(): Promise<ActionResult<AgencyRequest[]>> {
  try {
    const session = await requireAppSession();
    const db = await createScopedSupabase(session);
    if (!db) throw new Error("Supabase no configurado");
    const { data, error } = await db
      .from("agency_service_requests")
      .select("id, code, status, requested_service_date, notes, created_at, agency_id, request_scope, agency_customer_id, address_snapshot, agency_service_request_lines(id, service_kind, service_code, requested_quantity, confirmed_quantity, product_key, box_size, unit_charge_amount_cents, commercial_price_snapshot)")
      .eq("organization_id", session.organizationId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ok((data as AgencyRequestDbRow[] || []).map(mapRequest));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function createAgencyBoxRequestAction(input: {
  lines: Array<{ serviceCode: AgencyServiceCode; quantity: number; productKey: string; boxSize: string; inventoryItemId?: string; warehouseId?: string; customerId?: string; destinationCode?: string; address?: Record<string, unknown> }>;
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
      lines: lines.map((line) => ({ serviceCode: line.serviceCode, quantity: line.quantity, productKey: line.productKey.trim(), boxSize: line.boxSize.trim(), inventoryItemId: line.inventoryItemId || "", warehouseId: line.warehouseId || "", customerId: line.customerId || "", destinationCode: line.destinationCode || "", address: line.address || {} })),
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
      .select("id, code, status, requested_service_date, notes, created_at, agency_id, request_scope, agency_customer_id, address_snapshot, agency_service_request_lines(id, service_kind, service_code, requested_quantity, confirmed_quantity, product_key, box_size, unit_charge_amount_cents, commercial_price_snapshot), agencies!inner(id, organizations!agencies_organization_id_fkey(name))")
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
  lines: Array<{ id: string; label: string; requestedQuantity: number; serviceCode: AgencyServiceCode }>;
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
      .select("id, route_id, organization_id, address_snapshot, agencies!inner(organizations!agencies_organization_id_fkey(name)), agency_visit_lines(id, requested_quantity, agency_service_request_lines(service_kind, service_code, product_key, box_size))")
      .in("route_id", [...routeById.keys()])
      .in("status", ["assigned", "in_route", "scheduled"]);
    if (error) throw new Error(error.message);
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
          const serviceCode = (requestLine?.service_code || (requestLine?.service_kind === "empty_box_delivery" ? "agency_office_empty_box_delivery" : "agency_office_full_box_pickup")) as AgencyServiceCode;
          const labelByCode: Record<AgencyServiceCode, string> = { agency_office_empty_box_delivery: "Entregar cajas vacías en agencia", agency_office_full_box_pickup: "Recoger cajas llenas en agencia", customer_home_delivery: "Atender domicilio del cliente", customer_empty_box_delivery: "Entregar caja vacía al cliente", customer_full_box_pickup: "Recoger caja llena del cliente" };
          return { id: line.id, requestedQuantity: Number(line.requested_quantity), serviceCode, label: `${labelByCode[serviceCode]} ${requestLine?.product_key || ""} ${requestLine?.box_size || ""}`.trim() };
        }),
      };
    }));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function completeConductorAgencyVisitAction(input: { visitId: string; lines: Array<{ visitLineId: string; confirmedQuantity: number; differenceReason?: string; evidence?: Record<string, unknown> }> }): Promise<ActionResult<{ paymentId: string | null }>> {
  try {
    const session = await requireAppSession();
    if (session.roleSlug !== "conductor") throw new Error("FORBIDDEN");
    const db = await createScopedSupabase(session);
    if (!db) throw new Error("Supabase no configurado");
    const { data, error } = await db.rpc("complete_agency_visit_by_driver", {
      target_visit_id: input.visitId,
      line_confirmations: input.lines.map((line) => ({ ...line, evidence: line.evidence || { source: "driver_confirmation" } })),
      confirmation_reason: "Confirmada por conductor",
      payment: null,
      idempotency_key: randomUUID(),
    });
    if (error) throw new Error(error.message);
    return ok({ paymentId: (data?.paymentId as string | null | undefined) || null });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
