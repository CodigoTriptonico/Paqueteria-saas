"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { requireAppSession } from "@/lib/auth/session";
import type { CommercialAudience, CommercialPriceKind } from "@/lib/commercial-config/resolver";
import { emptyCommercialEntityProfile, type CommercialAdminData, type CommercialEntityProfile } from "@/lib/commercial-config/types";
import { parseMoneyValue } from "@/lib/logistics-fees";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createScopedSupabase } from "@/lib/supabase/scoped";

function canRead(session: Awaited<ReturnType<typeof requireAppSession>>) {
  return sessionHasPermission(session, "commercial.settings.view") || sessionHasPermission(session, "commercial.settings.manage");
}

function canManage(session: Awaited<ReturnType<typeof requireAppSession>>) {
  return sessionHasPermission(session, "commercial.settings.manage");
}

function recordValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function profileFromRow(row: Record<string, unknown> | undefined): CommercialEntityProfile {
  if (!row) return emptyCommercialEntityProfile;
  return {
    countryCode: String(row.country_code || ""),
    warehouseId: row.warehouse_id ? String(row.warehouse_id) : null,
    zone: String(row.zone || ""),
    territory: String(row.territory || ""),
    visitFrequency: String(row.visit_frequency || ""),
    operationalStatus: row.operational_status === "paused" || row.operational_status === "inactive" ? row.operational_status : "active",
    enabledServices: Array.isArray(row.enabled_services) ? row.enabled_services.map(String) : ["international_shipping"],
    canModifyPublicPrice: Boolean(row.can_modify_public_price),
    maxDiscountBps: Number(row.max_discount_bps) || 0,
    address: recordValue(row.address),
    contact: recordValue(row.contact),
    logisticsOptions: recordValue(row.logistics_options),
  };
}

export async function loadCommercialAdminAction(): Promise<ActionResult<CommercialAdminData>> {
  try {
    const session = await requireAppSession();
    if (!canRead(session)) throw new Error("FORBIDDEN");
    const admin = createSupabaseAdminClient();
    if (!admin) throw new Error("Supabase no configurado");

    const [{ data: organization }, { data: countries, error: countryError }, { data: agencies, error: agencyError }, { data: sellers, error: sellerError }, { data: profiles }, { data: overrides }, { data: services }, { data: routes }, { data: assignments }, { data: warehouses }, { data: audit }] = await Promise.all([
      admin.from("organizations").select("tenant_id").eq("id", session.organizationId).single(),
      admin.from("pricing_countries").select("id, code, name, pricing_country_boxes(size, price, cost, catalog_key)").eq("organization_id", session.organizationId).order("sort_order").order("name"),
      admin.from("agencies").select("id, organization_id, code, status, created_at").eq("matrix_organization_id", session.organizationId).is("archived_at", null).order("created_at", { ascending: false }),
      admin.from("profiles").select("id, organization_id, email, full_name, is_active, created_at, roles!inner(slug)").eq("organization_id", session.organizationId).eq("roles.slug", "vendedor").is("archived_at", null).order("full_name"),
      admin.from("commercial_entity_profiles").select("*").eq("matrix_organization_id", session.organizationId),
      admin.from("commercial_pricing_overrides").select("id, audience, entity_id, destination_code, product_code, price_kind, service_concept, amount_cents, minimum_amount_cents, currency").eq("matrix_organization_id", session.organizationId).is("valid_until", null),
      admin.from("country_commercial_service_settings").select("id, destination_code, service_concept, amount_cents, currency").eq("matrix_organization_id", session.organizationId).eq("is_active", true),
      admin.from("logistics_route_templates").select("id, name, weekday").eq("organization_id", session.organizationId).order("weekday").order("name"),
      admin.from("agency_default_route_assignments").select("agency_id, route_template_id").is("ended_at", null),
      admin.from("warehouses").select("id, name").eq("organization_id", session.organizationId).eq("is_active", true).order("name"),
      admin.from("immutable_audit_events").select("id, action, entity_type, entity_id, actor_user_id, occurred_at, before_state, after_state, metadata").eq("organization_id", session.organizationId).in("action", ["commercial.override.changed", "commercial.override.restored", "commercial.country_service.changed", "commercial.profile.changed", "agency.default_route.changed"]).order("occurred_at", { ascending: false }).limit(100),
    ]);
    if (!organization?.tenant_id) throw new Error("La matriz no tiene tenant comercial");
    if (countryError || agencyError || sellerError) throw new Error(countryError?.message || agencyError?.message || sellerError?.message || "No se pudo cargar la configuracion comercial");

    const agencyOrganizationIds = (agencies || []).map((row) => row.organization_id);
    const [{ data: agencyOrganizations }, { data: agencyUsers }] = await Promise.all([
      agencyOrganizationIds.length ? admin.from("organizations").select("id, name").in("id", agencyOrganizationIds) : Promise.resolve({ data: [] }),
      agencyOrganizationIds.length ? admin.from("profiles").select("id, organization_id, email").in("organization_id", agencyOrganizationIds).is("archived_at", null) : Promise.resolve({ data: [] }),
    ]);
    const nameByOrganization = new Map((agencyOrganizations || []).map((row) => [row.id, row.name]));
    const profileByKey = new Map((profiles || []).map((row) => [`${row.entity_type}:${row.entity_id}`, row as Record<string, unknown>]));
    const routeById = new Map((routes || []).map((row) => [row.id, row.name]));
    const assignmentByAgency = new Map((assignments || []).map((row) => [row.agency_id, row.route_template_id]));
    const usersByOrganization = new Map<string, number>();
    for (const row of agencyUsers || []) usersByOrganization.set(row.organization_id, (usersByOrganization.get(row.organization_id) || 0) + 1);

    const catalog = (countries || []).flatMap((country) => (country.pricing_country_boxes || []).map((box) => ({
      destinationCode: String(country.code).toUpperCase(), destinationName: country.name,
      productCode: box.catalog_key || box.size, productName: box.size,
      publicBaseCents: Math.round(parseMoneyValue(box.price || "$0") * 100),
      internalBaseCents: Math.round(parseMoneyValue(box.cost || "$0") * 100), currency: "USD",
    })));
    const entities = [
      ...(agencies || []).map((agency) => {
        const routeTemplateId = assignmentByAgency.get(agency.id) || null;
        return { id: agency.id, type: "agency" as const, name: nameByOrganization.get(agency.organization_id) || "Agencia", code: agency.code, status: agency.status, email: "", createdAt: agency.created_at, organizationId: agency.organization_id, userCount: usersByOrganization.get(agency.organization_id) || 0, routeTemplateId, routeName: routeTemplateId ? routeById.get(routeTemplateId) || "Ruta" : "Sin ruta", profile: profileFromRow(profileByKey.get(`agency:${agency.id}`)) };
      }),
      ...(sellers || []).map((seller) => ({ id: seller.id, type: "seller" as const, name: seller.full_name || seller.email, code: "VEN", status: seller.is_active ? "active" : "inactive", email: seller.email, createdAt: seller.created_at, organizationId: seller.organization_id, userCount: 1, routeTemplateId: null, routeName: "Sin ruta", profile: profileFromRow(profileByKey.get(`seller:${seller.id}`)) })),
    ];
    return ok({
      canManage: canManage(session),
      countries: (countries || []).map((country) => ({ code: String(country.code).toUpperCase(), name: country.name, currency: "USD" })),
      catalog,
      countryServices: (services || []).map((row) => ({ id: row.id, destinationCode: row.destination_code, serviceConcept: row.service_concept as "home_delivery" | "home_pickup", amountCents: Number(row.amount_cents), currency: row.currency })),
      overrides: (overrides || []).map((row) => ({ id: row.id, audience: row.audience as CommercialAudience, entityId: row.entity_id, destinationCode: row.destination_code, productCode: row.product_code, priceKind: row.price_kind as CommercialPriceKind, serviceConcept: row.service_concept as "international_shipping" | "home_delivery" | "home_pickup", amountCents: Number(row.amount_cents), minimumAmountCents: row.minimum_amount_cents === null ? null : Number(row.minimum_amount_cents), currency: row.currency, sourceLevel: row.entity_id ? "entity" : "group" })),
      entities, routeTemplates: (routes || []).map((row) => ({ id: row.id, name: row.name, weekday: Number(row.weekday) })),
      warehouses: (warehouses || []).map((row) => ({ id: row.id, name: row.name })),
      audit: (audit || []).map((row) => ({ id: row.id, action: row.action, entityType: row.entity_type, entityId: row.entity_id, actorUserId: row.actor_user_id, occurredAt: row.occurred_at, beforeState: recordValue(row.before_state), afterState: recordValue(row.after_state), metadata: recordValue(row.metadata) })),
    });
  } catch (error) { return fail(actionErrorMessage(error)); }
}

export async function saveCommercialOverrideAction(input: { audience: CommercialAudience; entityId?: string | null; destinationCode: string; productCode: string; priceKind: CommercialPriceKind; serviceConcept: "international_shipping" | "home_delivery" | "home_pickup"; amountCents: number; minimumAmountCents?: number | null; currency?: string }): Promise<ActionResult<{ overrideId: string }>> {
  try {
    const session = await requireAppSession(); if (!canManage(session)) throw new Error("FORBIDDEN");
    if (!Number.isSafeInteger(input.amountCents) || input.amountCents < 0) return fail("Ingresa un monto valido");
    if (input.minimumAmountCents !== null && input.minimumAmountCents !== undefined && (!Number.isSafeInteger(input.minimumAmountCents) || input.minimumAmountCents < 0 || input.minimumAmountCents > input.amountCents)) return fail("El precio mínimo debe ser un monto válido y no superar el precio configurado");
    const db = await createScopedSupabase(session); if (!db) throw new Error("Supabase no configurado");
    const { data, error } = await db.rpc("save_commercial_price_override", { target_audience: input.audience, target_entity_id: input.entityId || null, target_destination_code: input.destinationCode, target_product_code: input.productCode, target_price_kind: input.priceKind, target_service_concept: input.serviceConcept, target_amount_cents: input.amountCents, target_minimum_amount_cents: input.minimumAmountCents ?? null, target_currency: input.currency || "USD", target_calculation_rule: { type: "fixed" }, idempotency_key: randomUUID() });
    if (error || !data?.overrideId) throw new Error(error?.message || "No se pudo guardar la excepcion"); revalidatePath("/agencias"); revalidatePath("/vendedores"); return ok({ overrideId: String(data.overrideId) });
  } catch (error) { return fail(actionErrorMessage(error)); }
}

export async function restoreCommercialInheritanceAction(overrideId: string): Promise<ActionResult<null>> {
  try { const session=await requireAppSession(); if(!canManage(session)) throw new Error("FORBIDDEN"); const db=await createScopedSupabase(session); if(!db) throw new Error("Supabase no configurado"); const {error}=await db.rpc("restore_commercial_price_inheritance",{target_override_id:overrideId,idempotency_key:randomUUID()}); if(error) throw new Error(error.message); revalidatePath("/agencias"); revalidatePath("/vendedores"); return ok(null); } catch(error){ return fail(actionErrorMessage(error)); }
}

export async function saveCountryCommercialServiceAction(input: { destinationCode: string; serviceConcept: "home_delivery" | "home_pickup"; amountCents: number; currency?: string }): Promise<ActionResult<null>> {
  try { const session=await requireAppSession(); if(!canManage(session)&&!sessionHasPermission(session,"settings.manage")) throw new Error("FORBIDDEN"); const db=await createScopedSupabase(session); if(!db) throw new Error("Supabase no configurado"); const {error}=await db.rpc("save_country_commercial_service",{target_destination_code:input.destinationCode,target_service_concept:input.serviceConcept,target_amount_cents:input.amountCents,target_currency:input.currency||"USD",target_calculation_rule:{type:"fixed"},idempotency_key:randomUUID()}); if(error) throw new Error(error.message); revalidatePath("/configuracion"); revalidatePath("/agencias"); return ok(null); } catch(error){ return fail(actionErrorMessage(error)); }
}

export async function saveCommercialEntityProfileAction(input: { entityType: "agency" | "seller"; entityId: string; profile: CommercialEntityProfile }): Promise<ActionResult<null>> {
  try { const session=await requireAppSession(); if(!canManage(session)) throw new Error("FORBIDDEN"); const db=await createScopedSupabase(session); if(!db) throw new Error("Supabase no configurado"); const {error}=await db.rpc("save_commercial_entity_profile",{target_entity_type:input.entityType,target_entity_id:input.entityId,profile_patch:input.profile,idempotency_key:randomUUID()}); if(error) throw new Error(error.message); revalidatePath("/agencias"); revalidatePath("/vendedores"); return ok(null); } catch(error){ return fail(actionErrorMessage(error)); }
}

export async function changeAgencyDefaultRouteAction(input: { agencyId: string; routeTemplateId: string; reason: string }): Promise<ActionResult<null>> {
  try { const session=await requireAppSession(); if(!canManage(session)&&!sessionHasPermission(session,"agency.edit")) throw new Error("FORBIDDEN"); const db=await createScopedSupabase(session); if(!db) throw new Error("Supabase no configurado"); const {error}=await db.rpc("change_agency_default_route",{target_agency_id:input.agencyId,target_route_template_id:input.routeTemplateId,change_reason:input.reason,idempotency_key:randomUUID()}); if(error) throw new Error(error.message); revalidatePath("/agencias"); return ok(null); } catch(error){ return fail(actionErrorMessage(error)); }
}
