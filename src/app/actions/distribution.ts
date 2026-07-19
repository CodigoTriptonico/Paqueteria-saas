"use server";

import { requireAppSession } from "@/lib/auth/session";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import { availableDistributionCredit, distributionBalance, type DistributionLedgerEntry } from "@/lib/distribution/ledger";
import { normalizePersonName, normalizePersonNameSnapshot } from "@/lib/person-name";

type DistributionOffer = {
  id: string;
  countryName: string;
  catalogKey: string;
  productName: string;
  wholesalePrice: number;
  publicPrice: number | null;
  isActive: boolean;
};

type DistributionLedgerRow = DistributionLedgerEntry & {
  id: string;
  shipmentCode: string | null;
  note: string;
};

export type DistributionPartner = {
  id: string;
  name: string;
  distributorOrganizationId: string;
  acquisitionOwnerId: string | null;
  acquisitionOwnerName: string | null;
  ownerId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  createdAt: string;
  creditLimit: number;
  balance: number;
  availableCredit: number;
  isActive: boolean;
  offers: DistributionOffer[];
  ledger: DistributionLedgerRow[];
  shipments: DistributionShipment[];
};

type DistributionShipment = {
  id: string;
  code: string;
  status: string;
  publicPrice: number;
  createdAt: string;
};

export type DistributionCatalogItem = {
  countryName: string;
  catalogKey: string;
  productName: string;
};

export type DistributionWorkspace = {
  mode: "matrix" | "distributor";
  partners: DistributionPartner[];
  catalog: DistributionCatalogItem[];
  captors: DistributionCaptor[];
};

export type DistributionCaptor = { id: string; name: string };

type PartnerDbRow = {
  id: string;
  distributor_organization_id: string;
  credit_limit: number | string;
  is_active: boolean;
  created_at: string;
  acquisition_owner_id: string | null;
  organizations: { name: string } | { name: string }[] | null;
};

type PartnerOwnerDbRow = {
  id: string;
  organization_id: string;
  full_name: string | null;
  email: string;
};

type OfferDbRow = {
  id: string;
  partner_id: string;
  country_name: string;
  catalog_key: string;
  product_name: string;
  wholesale_price: number | string;
  public_price: number | string | null;
  is_active: boolean;
};

type LedgerDbRow = {
  id: string;
  partner_id: string;
  kind: DistributionLedgerRow["kind"];
  amount: number | string;
  note: string;
  created_at: string;
  shipments: { code: string } | { code: string }[] | null;
};

type ShipmentDbRow = {
  id: string;
  distribution_partner_id: string;
  code: string;
  status: string;
  distributor_public_price: number | string;
  created_at: string;
};

function numberValue(value: number | string | null | undefined) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function relatedName(row: PartnerDbRow["organizations"]) {
  return Array.isArray(row) ? row[0]?.name || "Distribuidor" : row?.name || "Distribuidor";
}

function relatedShipmentCode(row: LedgerDbRow["shipments"]) {
  return Array.isArray(row) ? row[0]?.code || null : row?.code || null;
}

function assertMatrixManager(session: Awaited<ReturnType<typeof requireAppSession>>) {
  if (!sessionHasPermission(session, "settings.manage")) {
    throw new Error("FORBIDDEN");
  }
}

function assertDistributionCaptor(session: Awaited<ReturnType<typeof requireAppSession>>) {
  if (session.roleSlug !== "captador_distribuidores" || !sessionHasPermission(session, "distribution.acquire")) {
    throw new Error("FORBIDDEN");
  }
}

async function loadPartnerRows(parentOrganizationId?: string, distributorOrganizationId?: string, acquisitionOwnerId?: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error("Supabase no configurado");
  }

  let query = admin
    .from("distribution_partners")
    .select("id, distributor_organization_id, credit_limit, is_active, created_at, acquisition_owner_id, organizations!distribution_partners_distributor_organization_id_fkey(name)")
    .order("created_at", { ascending: false });

  if (parentOrganizationId) {
    query = query.eq("parent_organization_id", parentOrganizationId);
  }
  if (distributorOrganizationId) {
    query = query.eq("distributor_organization_id", distributorOrganizationId);
  }
  if (acquisitionOwnerId) {
    query = query.eq("acquisition_owner_id", acquisitionOwnerId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  return (data || []) as unknown as PartnerDbRow[];
}

async function hydratePartners(rows: PartnerDbRow[]): Promise<DistributionPartner[]> {
  if (!rows.length) {
    return [];
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error("Supabase no configurado");
  }
  const partnerIds = rows.map((row) => row.id);
  const organizationIds = rows.map((row) => row.distributor_organization_id);
  const acquisitionOwnerIds = rows.flatMap((row) => row.acquisition_owner_id ? [row.acquisition_owner_id] : []);
  const [offersResult, ledgerResult, shipmentsResult, ownersResult, captorProfilesResult] = await Promise.all([
    admin
      .from("distribution_partner_offers")
      .select("id, partner_id, country_name, catalog_key, product_name, wholesale_price, public_price, is_active")
      .in("partner_id", partnerIds)
      .order("country_name")
      .order("product_name"),
    admin
      .from("distribution_partner_ledger")
      .select("id, partner_id, kind, amount, note, created_at, shipments(code)")
      .in("partner_id", partnerIds)
      .order("created_at", { ascending: false }),
    admin
      .from("shipments")
      .select("id, distribution_partner_id, code, status, distributor_public_price, created_at")
      .in("distribution_partner_id", partnerIds)
      .order("created_at", { ascending: false }),
    admin
      .from("profiles")
      .select("id, organization_id, full_name, email")
      .in("organization_id", organizationIds)
      .order("created_at", { ascending: true }),
    acquisitionOwnerIds.length
      ? admin.from("profiles").select("id, full_name, email").in("id", acquisitionOwnerIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (offersResult.error) throw new Error(offersResult.error.message);
  if (ledgerResult.error) throw new Error(ledgerResult.error.message);
  if (shipmentsResult.error) throw new Error(shipmentsResult.error.message);
  if (ownersResult.error) throw new Error(ownersResult.error.message);
  if (captorProfilesResult.error) throw new Error(captorProfilesResult.error.message);

  const offers = (offersResult.data || []) as unknown as OfferDbRow[];
  const ledger = (ledgerResult.data || []) as unknown as LedgerDbRow[];
  const shipments = (shipmentsResult.data || []) as unknown as ShipmentDbRow[];
  const owners = (ownersResult.data || []) as unknown as PartnerOwnerDbRow[];
  const captorProfiles = (captorProfilesResult.data || []) as { id: string; full_name: string | null; email: string }[];

  return rows.map((row) => {
    const partnerLedger = ledger
      .filter((entry) => entry.partner_id === row.id)
      .map((entry) => ({
        id: entry.id,
        kind: entry.kind,
        amount: numberValue(entry.amount),
        note: entry.note,
        createdAt: entry.created_at,
        shipmentCode: relatedShipmentCode(entry.shipments),
      }));
    const balance = distributionBalance(partnerLedger);
    const creditLimit = numberValue(row.credit_limit);
    const owner = owners.find((profile) => profile.organization_id === row.distributor_organization_id) || null;
    const captor = captorProfiles.find((profile) => profile.id === row.acquisition_owner_id) || null;
    return {
      id: row.id,
      name: relatedName(row.organizations),
      distributorOrganizationId: row.distributor_organization_id,
      acquisitionOwnerId: row.acquisition_owner_id,
      acquisitionOwnerName: captor ? (captor.full_name || captor.email) : null,
      ownerId: owner?.id || null,
      ownerName: owner?.full_name || null,
      ownerEmail: owner?.email || null,
      createdAt: row.created_at,
      creditLimit,
      balance,
      availableCredit: availableDistributionCredit(creditLimit, balance),
      isActive: row.is_active,
      offers: offers.filter((offer) => offer.partner_id === row.id).map((offer) => ({
        id: offer.id,
        countryName: offer.country_name,
        catalogKey: offer.catalog_key,
        productName: offer.product_name,
        wholesalePrice: numberValue(offer.wholesale_price),
        publicPrice: offer.public_price === null ? null : numberValue(offer.public_price),
        isActive: offer.is_active,
      })),
      ledger: partnerLedger,
      shipments: shipments.filter((shipment) => shipment.distribution_partner_id === row.id).map((shipment) => ({
        id: shipment.id,
        code: shipment.code,
        status: shipment.status,
        publicPrice: numberValue(shipment.distributor_public_price),
        createdAt: shipment.created_at,
      })),
    };
  });
}

async function managedPartner(
  partnerId: string,
  parentOrganizationId: string,
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
) {
  const { data, error } = await admin
    .from("distribution_partners")
    .select("id, distributor_organization_id, acquisition_owner_id, credit_limit")
    .eq("id", partnerId)
    .eq("parent_organization_id", parentOrganizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("FORBIDDEN");
  return data as { id: string; distributor_organization_id: string; acquisition_owner_id: string | null; credit_limit: number | string };
}

export async function loadDistributionWorkspaceAction(): Promise<ActionResult<DistributionWorkspace>> {
  try {
    const session = await requireAppSession();
    const matrixMode = sessionHasPermission(session, "settings.manage");
    const rows = await loadPartnerRows(
      matrixMode ? session.organizationId : undefined,
      matrixMode ? undefined : session.organizationId,
    );
    const partners = await hydratePartners(rows);
    let catalog: DistributionCatalogItem[] = [];
    let captors: DistributionCaptor[] = [];

    if (matrixMode) {
      const admin = createSupabaseAdminClient();
      if (!admin) return fail("Supabase no configurado");
      const [catalogResult, captorsResult] = await Promise.all([
        admin
          .from("pricing_countries")
          .select("name, pricing_country_boxes(size, catalog_key)")
          .eq("organization_id", session.organizationId)
          .order("name"),
        admin
          .from("profiles")
          .select("id, full_name, email, roles!inner(slug)")
          .eq("organization_id", session.organizationId)
          .eq("is_active", true)
          .eq("roles.slug", "captador_distribuidores")
          .order("full_name"),
      ]);
      const { data, error } = catalogResult;
      if (error) throw new Error(error.message);
      if (captorsResult.error) throw new Error(captorsResult.error.message);
      catalog = (data || []).flatMap((country) => {
        const boxes = (country.pricing_country_boxes || []) as { size: string; catalog_key: string | null }[];
        return boxes
          .filter((box) => Boolean(box.catalog_key))
          .map((box) => ({
            countryName: country.name as string,
            catalogKey: box.catalog_key as string,
            productName: box.size,
          }));
      });
      captors = (captorsResult.data || []).map((profile) => ({
        id: profile.id as string,
        name: ((profile.full_name as string | null) || (profile.email as string) || "Captador").trim(),
      }));
    }

    return ok({ mode: matrixMode ? "matrix" : "distributor", partners, catalog, captors });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function createDistributionPartnerAction(input: {
  name: string;
  email: string;
  password: string;
  fullName?: string;
  creditLimit: number;
}): Promise<ActionResult<{ partnerId: string }>> {
  let createdUserId: string | null = null;
  let createdOrganizationId: string | null = null;
  try {
    const session = await requireAppSession();
    assertMatrixManager(session);
    const admin = createSupabaseAdminClient();
    if (!admin) return fail("Supabase no configurado");
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    const creditLimit = numberValue(input.creditLimit);
    if (!name || !email || input.password.length < 6 || creditLimit < 0) {
      return fail("Completa empresa, correo, contraseña y límite de crédito válido.");
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
    });
    if (createError || !created.user) return fail(createError?.message || "No se pudo crear el usuario");
    createdUserId = created.user.id;

    const { data: orgId, error: bootstrapError } = await admin.rpc("bootstrap_organization", {
      org_name: name,
      owner_id: created.user.id,
      owner_email: email,
      owner_name: input.fullName ? normalizePersonName(input.fullName) || null : null,
      org_slug: null,
      org_kind: "client",
      owner_phone: null,
    });
    if (bootstrapError || !orgId) throw new Error(bootstrapError?.message || "No se pudo crear el distribuidor");

    const distributorOrganizationId = orgId as string;
    createdOrganizationId = distributorOrganizationId;
    const { data: distributorRole, error: roleError } = await admin
      .from("roles")
      .insert({ organization_id: distributorOrganizationId, slug: "distribuidor", name: "Distribuidor", is_system: true })
      .select("id")
      .single();
    if (roleError || !distributorRole) throw new Error(roleError?.message || "No se pudo crear el rol distribuidor");

    const { data: permission } = await admin
      .from("permissions")
      .select("id")
      .eq("key", "distribution.sell")
      .single();
    if (!permission) throw new Error("Permiso de distribuidor no encontrado");
    const { error: permissionError } = await admin.from("role_permissions").insert({
      role_id: distributorRole.id,
      permission_id: permission.id,
      granted: true,
    });
    if (permissionError) throw new Error(permissionError.message);

    const { error: profileError } = await admin
      .from("profiles")
      .update({ role_id: distributorRole.id })
      .eq("id", created.user.id)
      .eq("organization_id", distributorOrganizationId);
    if (profileError) throw new Error(profileError.message);

    const { data: partner, error: partnerError } = await admin
      .from("distribution_partners")
      .insert({
        parent_organization_id: session.organizationId,
        distributor_organization_id: distributorOrganizationId,
        credit_limit: creditLimit,
      })
      .select("id")
      .single();
    if (partnerError || !partner) throw new Error(partnerError?.message || "No se pudo vincular el distribuidor");
    return ok({ partnerId: partner.id });
  } catch (error) {
    if (createdUserId) {
      const admin = createSupabaseAdminClient();
      await admin?.auth.admin.deleteUser(createdUserId);
      if (createdOrganizationId) {
        await admin?.from("organizations").delete().eq("id", createdOrganizationId);
      }
    }
    return fail(actionErrorMessage(error));
  }
}

export async function createAcquiredDistributionPartnerAction(input: {
  name: string;
  email: string;
  password: string;
  fullName?: string;
}): Promise<ActionResult<{ partnerId: string }>> {
  let createdUserId: string | null = null;
  let createdOrganizationId: string | null = null;
  try {
    const session = await requireAppSession();
    assertDistributionCaptor(session);
    const admin = createSupabaseAdminClient();
    if (!admin) return fail("Supabase no configurado");
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    if (!name || !email.includes("@") || input.password.length < 6) {
      return fail("Completa empresa, correo y contraseña válida.");
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password: input.password, email_confirm: true });
    if (createError || !created.user) return fail(createError?.message || "No se pudo crear el acceso");
    createdUserId = created.user.id;
    const { data: orgId, error: bootstrapError } = await admin.rpc("bootstrap_organization", {
      org_name: name,
      owner_id: created.user.id,
      owner_email: email,
      owner_name: input.fullName ? normalizePersonName(input.fullName) || null : null,
      org_slug: null,
      org_kind: "client",
      owner_phone: null,
    });
    if (bootstrapError || !orgId) throw new Error(bootstrapError?.message || "No se pudo crear el distribuidor");
    const distributorOrganizationId = orgId as string;
    createdOrganizationId = distributorOrganizationId;
    const { data: distributorRole, error: roleError } = await admin
      .from("roles")
      .insert({ organization_id: distributorOrganizationId, slug: "distribuidor", name: "Distribuidor", is_system: true })
      .select("id")
      .single();
    if (roleError || !distributorRole) throw new Error(roleError?.message || "No se pudo crear el rol distribuidor");
    const { data: permission } = await admin.from("permissions").select("id").eq("key", "distribution.sell").single();
    if (!permission) throw new Error("Permiso de distribuidor no encontrado");
    const [permissionResult, profileResult, organizationResult] = await Promise.all([
      admin.from("role_permissions").insert({ role_id: distributorRole.id, permission_id: permission.id, granted: true }),
      admin.from("profiles").update({ role_id: distributorRole.id, is_active: false }).eq("id", created.user.id).eq("organization_id", distributorOrganizationId),
      admin.from("organizations").update({ is_active: false }).eq("id", distributorOrganizationId),
    ]);
    if (permissionResult.error) throw new Error(permissionResult.error.message);
    if (profileResult.error) throw new Error(profileResult.error.message);
    if (organizationResult.error) throw new Error(organizationResult.error.message);
    const { data: partner, error: partnerError } = await admin
      .from("distribution_partners")
      .insert({
        parent_organization_id: session.organizationId,
        distributor_organization_id: distributorOrganizationId,
        acquisition_owner_id: session.userId,
        credit_limit: 0,
        is_active: false,
      })
      .select("id")
      .single();
    if (partnerError || !partner) throw new Error(partnerError?.message || "No se pudo vincular el distribuidor");
    const { error: historyError } = await admin.from("distribution_partner_owner_history").insert({
      partner_id: partner.id,
      previous_owner_id: null,
      owner_id: session.userId,
      changed_by: session.userId,
      reason: "Captado al crear distribuidor",
    });
    if (historyError) throw new Error(historyError.message);
    return ok({ partnerId: partner.id });
  } catch (error) {
    if (createdUserId) {
      const admin = createSupabaseAdminClient();
      await admin?.auth.admin.deleteUser(createdUserId);
      if (createdOrganizationId) await admin?.from("organizations").delete().eq("id", createdOrganizationId);
    }
    return fail(actionErrorMessage(error));
  }
}

export async function assignDistributionPartnerCaptorAction(input: {
  partnerId: string;
  captorId: string;
  reason?: string;
}): Promise<ActionResult<null>> {
  try {
    const session = await requireAppSession();
    assertMatrixManager(session);
    const supabase = await createScopedSupabase(session);
    if (!supabase) return fail("Supabase no configurado");
    const { error } = await supabase.rpc("distribution_assign_acquisition_owner", {
      target_partner_id: input.partnerId,
      target_owner_id: input.captorId,
      assignment_reason: input.reason?.trim() || "",
    });
    if (error) throw new Error(error.message);
    return ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function loadAcquisitionPortfolioAction(): Promise<ActionResult<DistributionPartner[]>> {
  try {
    const session = await requireAppSession();
    assertDistributionCaptor(session);
    return ok(await hydratePartners(await loadPartnerRows(session.organizationId, undefined, session.userId)));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function updateDistributionPartnerAction(input: {
  partnerId: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
}): Promise<ActionResult<null>> {
  try {
    const session = await requireAppSession();
    assertMatrixManager(session);
    const admin = createSupabaseAdminClient();
    if (!admin) return fail("Supabase no configurado");
    const name = input.name.trim();
    const ownerName = normalizePersonName(input.ownerName);
    const ownerEmail = input.ownerEmail.trim().toLowerCase();
    if (!input.partnerId || !name || !ownerEmail.includes("@")) {
      return fail("Completa empresa y correo del responsable.");
    }
    const partner = await managedPartner(input.partnerId, session.organizationId, admin);
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id")
      .eq("organization_id", partner.distributor_organization_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (!profile) throw new Error("No se encontró el acceso del distribuidor");
    const { error: authError } = await admin.auth.admin.updateUserById(profile.id, { email: ownerEmail });
    if (authError) throw new Error(authError.message);
    const [organizationResult, profileResult] = await Promise.all([
      admin.from("organizations").update({ name }).eq("id", partner.distributor_organization_id),
      admin.from("profiles").update({ email: ownerEmail, full_name: ownerName || null }).eq("id", profile.id),
    ]);
    if (organizationResult.error) throw new Error(organizationResult.error.message);
    if (profileResult.error) throw new Error(profileResult.error.message);
    return ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function updateDistributionCreditLimitAction(input: {
  partnerId: string;
  creditLimit: number;
}): Promise<ActionResult<null>> {
  try {
    const session = await requireAppSession();
    assertMatrixManager(session);
    const creditLimit = numberValue(input.creditLimit);
    if (!input.partnerId || creditLimit < 0) return fail("Límite de crédito inválido.");
    const admin = createSupabaseAdminClient();
    if (!admin) return fail("Supabase no configurado");
    await managedPartner(input.partnerId, session.organizationId, admin);
    const { error } = await admin
      .from("distribution_partners")
      .update({ credit_limit: creditLimit })
      .eq("id", input.partnerId)
      .eq("parent_organization_id", session.organizationId);
    if (error) throw new Error(error.message);
    return ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function setDistributionPartnerStatusAction(input: {
  partnerId: string;
  isActive: boolean;
}): Promise<ActionResult<null>> {
  try {
    const session = await requireAppSession();
    assertMatrixManager(session);
    const admin = createSupabaseAdminClient();
    if (!admin) return fail("Supabase no configurado");
    const partner = await managedPartner(input.partnerId, session.organizationId, admin);
    if (input.isActive && partner.acquisition_owner_id) {
      const { count, error: offersError } = await admin
        .from("distribution_partner_offers")
        .select("id", { count: "exact", head: true })
        .eq("partner_id", partner.id)
        .eq("is_active", true);
      if (offersError) throw new Error(offersError.message);
      if (!count || numberValue(partner.credit_limit) <= 0) {
        return fail("Configura al menos un producto activo y un límite de crédito antes de activar al distribuidor.");
      }
    }
    const [partnerResult, organizationResult, profilesResult] = await Promise.all([
      admin.from("distribution_partners").update({ is_active: input.isActive }).eq("id", partner.id),
      admin.from("organizations").update({ is_active: input.isActive }).eq("id", partner.distributor_organization_id),
      admin.from("profiles").update({ is_active: input.isActive }).eq("organization_id", partner.distributor_organization_id),
    ]);
    if (partnerResult.error) throw new Error(partnerResult.error.message);
    if (organizationResult.error) throw new Error(organizationResult.error.message);
    if (profilesResult.error) throw new Error(profilesResult.error.message);
    return ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function resetDistributionPartnerPasswordAction(input: {
  partnerId: string;
  password: string;
}): Promise<ActionResult<null>> {
  try {
    const session = await requireAppSession();
    assertMatrixManager(session);
    if (!input.partnerId || input.password.length < 6) return fail("La contraseña debe tener al menos 6 caracteres.");
    const admin = createSupabaseAdminClient();
    if (!admin) return fail("Supabase no configurado");
    const partner = await managedPartner(input.partnerId, session.organizationId, admin);
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id")
      .eq("organization_id", partner.distributor_organization_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (!profile) throw new Error("No se encontró el acceso del distribuidor");
    const { error } = await admin.auth.admin.updateUserById(profile.id, { password: input.password });
    if (error) throw new Error(error.message);
    return ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function exportDistributionLedgerAction(input: {
  partnerId: string;
}): Promise<ActionResult<{ filename: string; csv: string }>> {
  try {
    const session = await requireAppSession();
    assertMatrixManager(session);
    const admin = createSupabaseAdminClient();
    if (!admin) return fail("Supabase no configurado");
    const partner = await managedPartner(input.partnerId, session.organizationId, admin);
    const [rows] = await Promise.all([loadPartnerRows(session.organizationId)]);
    const hydrated = await hydratePartners(rows.filter((row) => row.id === partner.id));
    const selected = hydrated[0];
    if (!selected) throw new Error("Distribuidor no encontrado");
    const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    let runningBalance = 0;
    const chronologicalRows = selected.ledger.slice().reverse().map((entry) => {
      runningBalance += entry.amount;
      return [entry.createdAt, entry.kind, entry.shipmentCode || "", entry.note, entry.amount, runningBalance].map(escape).join(",");
    });
    const csv = [
      ["Fecha", "Tipo", "Referencia", "Nota", "Monto", "Saldo"].map(escape).join(","),
      ...chronologicalRows,
    ].join("\n");
    return ok({ filename: `cuenta-${selected.name.toLowerCase().replaceAll(/[^a-z0-9]+/gi, "-")}.csv`, csv });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function saveDistributionOfferAction(input: {
  partnerId: string;
  countryName: string;
  catalogKey: string;
  productName: string;
  wholesalePrice: number;
  isActive: boolean;
}): Promise<ActionResult<null>> {
  try {
    const session = await requireAppSession();
    assertMatrixManager(session);
    const wholesalePrice = numberValue(input.wholesalePrice);
    if (!input.partnerId || !input.countryName.trim() || !input.catalogKey.trim() || wholesalePrice < 0) {
      return fail("Oferta mayorista inválida.");
    }
    const admin = createSupabaseAdminClient();
    if (!admin) return fail("Supabase no configurado");
    const { data: partner } = await admin
      .from("distribution_partners")
      .select("id")
      .eq("id", input.partnerId)
      .eq("parent_organization_id", session.organizationId)
      .maybeSingle();
    if (!partner) throw new Error("FORBIDDEN");
    const { error } = await admin.from("distribution_partner_offers").upsert({
      partner_id: input.partnerId,
      country_name: input.countryName.trim(),
      catalog_key: input.catalogKey.trim(),
      product_name: input.productName.trim(),
      wholesale_price: wholesalePrice,
      is_active: input.isActive,
      updated_at: new Date().toISOString(),
    }, { onConflict: "partner_id,country_name,catalog_key" });
    if (error) throw new Error(error.message);
    return ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function setDistributionPublicPriceAction(input: {
  offerId: string;
  publicPrice: number;
}): Promise<ActionResult<null>> {
  try {
    const session = await requireAppSession();
    const publicPrice = numberValue(input.publicPrice);
    if (!input.offerId || publicPrice <= 0) return fail("Ingresa un precio público mayor que cero.");
    const admin = createSupabaseAdminClient();
    if (!admin) return fail("Supabase no configurado");
    const { data: offer, error } = await admin
      .from("distribution_partner_offers")
      .select("id, distribution_partners!inner(distributor_organization_id, is_active)")
      .eq("id", input.offerId)
      .maybeSingle();
    if (error || !offer) throw new Error("FORBIDDEN");
    const partner = offer.distribution_partners as { distributor_organization_id: string; is_active: boolean } | { distributor_organization_id: string; is_active: boolean }[] | null;
    const linked = Array.isArray(partner) ? partner[0] : partner;
    if (!linked || linked.distributor_organization_id !== session.organizationId || !linked.is_active) throw new Error("FORBIDDEN");
    const { error: updateError } = await admin
      .from("distribution_partner_offers")
      .update({ public_price: publicPrice, updated_at: new Date().toISOString() })
      .eq("id", input.offerId);
    if (updateError) throw new Error(updateError.message);
    return ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function recordDistributionPaymentAction(input: {
  partnerId: string;
  amount: number;
  note?: string;
}): Promise<ActionResult<{ balance: number }>> {
  try {
    const session = await requireAppSession();
    assertMatrixManager(session);
    const supabase = await createScopedSupabase(session);
    if (!supabase) return fail("Supabase no configurado");
    const { data, error } = await supabase.rpc("distribution_record_payment", {
      target_partner_id: input.partnerId,
      payment_amount: numberValue(input.amount),
      payment_note: input.note?.trim() || "",
    });
    if (error) throw new Error(error.message);
    return ok({ balance: numberValue(data as number | string) });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function createDistributionSaleAction(input: {
  offerId: string;
  customerName: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientAddress?: string;
  carrier?: string;
  notes?: string;
}): Promise<ActionResult<{ shipmentId: string; shipmentCode: string }>> {
  try {
    const session = await requireAppSession();
    const supabase = await createScopedSupabase(session);
    if (!supabase) return fail("Supabase no configurado");
    const recipientSnapshot = normalizePersonNameSnapshot({
      name: input.recipientName || "",
      phone: input.recipientPhone?.trim() || "",
      address: input.recipientAddress?.trim() || "",
      source: "distributor",
    });
    const { data, error } = await supabase.rpc("distribution_create_sale", {
      target_offer_id: input.offerId,
      customer_name_input: normalizePersonName(input.customerName),
      recipient_snapshot_input: recipientSnapshot,
      carrier_input: input.carrier?.trim() || "",
      delivery_notes_input: input.notes?.trim() || "",
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.shipment_id || !row?.shipment_code) throw new Error("No se pudo crear el envío");
    return ok({ shipmentId: row.shipment_id as string, shipmentCode: row.shipment_code as string });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
