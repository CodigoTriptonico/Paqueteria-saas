"use server";

import { requirePlatformAdmin } from "@/lib/auth/platform";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  actionErrorMessage,
  fail,
  ok,
  type ActionResult,
} from "@/lib/actions/errors";
import type { PlatformOrganizationRow } from "@/lib/auth/types";
import {
  canDeactivateOrganization,
  isClientOrganization,
} from "@/lib/organizations/kind";
import { slugifyOrgName } from "@/lib/organizations/slug";
import { isValidNationalPhone } from "@/lib/phone/countries";
import {
  normalizePhoneDigits,
  normalizePhoneE164,
} from "@/lib/phone/normalize";
import { assertPhoneAvailable } from "@/lib/phone/profile-phone";
import { syncProfileRecoveryPhones } from "@/lib/phone/profile-phones";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  DEFAULT_MAX_USERS,
  DEFAULT_MAX_WAREHOUSES,
  isAgencyModuleEnabled,
  parsePlanLimit,
  type OrganizationSettings,
} from "@/lib/organizations/settings";
import { deleteAuthUserSafely } from "@/lib/security/auth-cleanup";
import { normalizePersonName } from "@/lib/person-name";

export async function listAllOrganizationsAction(): Promise<
  ActionResult<PlatformOrganizationRow[]>
> {
  try {
    await requirePlatformAdmin();
    const admin = createSupabaseAdminClient();
    if (!admin) return fail("Supabase no configurado");
    const { data: orgs, error } = await admin
      .from("organizations")
      .select("id, name, slug, kind, is_active, created_at, settings")
      .eq("kind", "client")
      .order("created_at", { ascending: false });
    if (error) return fail(error.message);
    const [{ data: profiles }, { data: warehouses }] = await Promise.all([
      admin.from("profiles").select("id, organization_id"),
      admin.from("warehouses").select("id, organization_id"),
    ]);
    const userCount = new Map<string, number>();
    const warehouseCount = new Map<string, number>();
    for (const row of profiles || [])
      userCount.set(
        row.organization_id,
        (userCount.get(row.organization_id) || 0) + 1,
      );
    for (const row of warehouses || [])
      warehouseCount.set(
        row.organization_id,
        (warehouseCount.get(row.organization_id) || 0) + 1,
      );
    return ok(
      (orgs || [])
        .filter((org) => isClientOrganization(org.kind))
        .map((org) => {
          const settings = (org.settings || {}) as OrganizationSettings;
          return {
            id: org.id,
            name: org.name,
            slug: org.slug,
            kind: "client",
            is_active: org.is_active,
            created_at: org.created_at,
            user_count: userCount.get(org.id) || 0,
            warehouse_count: warehouseCount.get(org.id) || 0,
            max_users: parsePlanLimit(settings.max_users),
            max_warehouses: parsePlanLimit(settings.max_warehouses),
            agencies_enabled: isAgencyModuleEnabled(settings),
          };
        }),
    );
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

function normalizeContactList(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

/** Creates the client organization and only its first, client-owned administrator. */
export async function createOrganizationAction(input: {
  name: string;
  slug?: string;
  adminEmail: string;
  adminPassword: string;
  adminFullName?: string;
  adminPhones: string[];
  settings?: { maxUsers?: number; maxWarehouses?: number; agenciesEnabled?: boolean };
}): Promise<ActionResult<{ organizationId: string }>> {
  try {
    await requirePlatformAdmin();
    if (!isSupabaseConfigured()) return fail("Supabase no configurado");
    const admin = createSupabaseAdminClient();
    if (!admin) return fail("Supabase no configurado");
    const orgName = input.name.trim();
    const orgSlug = (input.slug?.trim() || slugifyOrgName(orgName)).slice(
      0,
      80,
    );
    const email = input.adminEmail.trim().toLowerCase();
    const phones = normalizeContactList(input.adminPhones);
    const primaryPhone = phones[0] || "";
    const primaryPhoneE164 = normalizePhoneE164(primaryPhone);
    if (!orgName || !email || input.adminPassword.length < 6)
      return fail(
        "Completa nombre, correo del administrador y contrasena de al menos 6 caracteres.",
      );
    if (!primaryPhoneE164 || !isValidNationalPhone(primaryPhone))
      return fail("Ingresa un celular valido para el administrador.");
    for (const phone of phones) {
      if (!isValidNationalPhone(phone))
        return fail("Uno de los celulares no es valido.");
      const conflict = await assertPhoneAvailable(admin, phone);
      if (conflict) return fail(conflict);
    }
    if (
      new Set(phones.map((phone) => normalizePhoneDigits(phone))).size !==
      phones.length
    )
      return fail("No repitas celulares del administrador.");
    const { data: slugConflict } = await admin
      .from("organizations")
      .select("id")
      .eq("slug", orgSlug)
      .maybeSingle();
    if (slugConflict) return fail("Ya existe una empresa con ese nombre.");
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password: input.adminPassword,
        email_confirm: true,
      });
    if (createError || !created.user)
      return fail(
        createError?.message || "No se pudo crear el administrador inicial.",
      );
    const { data: organizationId, error: bootstrapError } = await admin.rpc(
      "bootstrap_organization",
      {
        org_name: orgName,
        owner_id: created.user.id,
        owner_email: email,
        owner_name: input.adminFullName
          ? normalizePersonName(input.adminFullName) || null
          : null,
        org_slug: orgSlug || null,
        org_kind: "client",
        owner_phone: primaryPhoneE164,
      },
    );
    if (bootstrapError || !organizationId) {
      await deleteAuthUserSafely(admin, created.user.id);
      return fail(bootstrapError?.message || "No se pudo crear la empresa.");
    }
    const { error: businessInitializationError } = await admin.rpc(
      "initialize_business_matrix_organization",
      { target_organization_id: organizationId as string },
    );
    if (businessInitializationError) {
      return fail(
        businessInitializationError.message || "No se pudo preparar la empresa para operar agencias.",
      );
    }
    const maxUsers = Math.max(
      1,
      Math.min(500, Math.trunc(input.settings?.maxUsers || DEFAULT_MAX_USERS)),
    );
    const maxWarehouses = Math.max(
      1,
      Math.min(100, Math.trunc(input.settings?.maxWarehouses || DEFAULT_MAX_WAREHOUSES)),
    );
    const { data: org } = await admin
      .from("organizations")
      .select("settings")
      .eq("id", organizationId as string)
      .single();
    const { error: settingsError } = await admin
      .from("organizations")
      .update({
        settings: {
          ...((org?.settings as Record<string, unknown> | undefined) || {}),
          multi_warehouse_enabled: maxWarehouses > 1,
          max_users: maxUsers,
          max_warehouses: maxWarehouses,
          agencies_enabled: input.settings?.agenciesEnabled === true,
          owner_contact_phones: phones.map(
            (phone) => normalizePhoneE164(phone) || phone,
          ),
        },
      })
      .eq("id", organizationId as string);
    if (settingsError) return fail(settingsError.message);
    try {
      await syncProfileRecoveryPhones(
        admin,
        created.user.id,
        phones.map((phone) => normalizePhoneE164(phone) || phone),
      );
      await admin.auth.admin.updateUserById(created.user.id, {
        phone: primaryPhoneE164,
        phone_confirm: true,
      });
    } catch (error) {
      return fail(actionErrorMessage(error));
    }
    return ok({ organizationId: organizationId as string });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function updateOrganizationAction(input: {
  organizationId: string;
  name: string;
  slug?: string;
  maxUsers?: number | null;
  maxWarehouses?: number;
  agenciesEnabled?: boolean;
}): Promise<ActionResult<null>> {
  try {
    await requirePlatformAdmin();
    const admin = createSupabaseAdminClient();
    if (!admin) return fail("Supabase no configurado");
    const name = input.name.trim();
    const slug = (input.slug?.trim() || slugifyOrgName(name)).slice(0, 80);
    if (!name || !slug) return fail("Nombre y slug son obligatorios.");
    const { data: org, error: orgError } = await admin
      .from("organizations")
      .select("settings")
      .eq("id", input.organizationId)
      .eq("kind", "client")
      .single();
    if (orgError || !org)
      return fail(orgError?.message || "Empresa no encontrada.");
    const settings: OrganizationSettings = {
      ...((org.settings as OrganizationSettings) || {}),
    };
    if (input.maxWarehouses !== undefined) {
      const { count } = await admin
        .from("warehouses")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", input.organizationId);
      const limit = Math.max(
        count || 0,
        Math.max(1, Math.min(100, Math.trunc(input.maxWarehouses))),
      );
      settings.max_warehouses = limit;
      settings.multi_warehouse_enabled = limit > 1;
    }
    if (input.maxUsers !== undefined) {
      if (input.maxUsers === null) {
        delete settings.max_users;
      } else {
        const { count } = await admin
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", input.organizationId);
        const limit = Math.max(
          Math.max(0, (count || 0) - 1),
          Math.max(1, Math.min(500, Math.trunc(input.maxUsers))),
        );
        settings.max_users = limit;
      }
    }
    if (input.agenciesEnabled !== undefined) {
      settings.agencies_enabled = input.agenciesEnabled === true;
    }
    const { error } = await admin
      .from("organizations")
      .update({ name, slug, settings })
      .eq("id", input.organizationId)
      .eq("kind", "client");
    return error ? fail(error.message) : ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function deactivateOrganizationAction(
  organizationId: string,
): Promise<ActionResult<null>> {
  try {
    await requirePlatformAdmin();
    const admin = createSupabaseAdminClient();
    if (!admin) return fail("Supabase no configurado");
    const { data: org, error: lookupError } = await admin
      .from("organizations")
      .select("kind")
      .eq("id", organizationId)
      .single();
    if (lookupError || !org)
      return fail(lookupError?.message || "Empresa no encontrada.");
    if (!canDeactivateOrganization(org.kind))
      return fail("No se puede desactivar la organizacion de plataforma.");
    const { error: orgError } = await admin
      .from("organizations")
      .update({ is_active: false })
      .eq("id", organizationId)
      .eq("kind", "client");
    if (orgError) return fail(orgError.message);
    const { error: profileError } = await admin
      .from("profiles")
      .update({ is_active: false })
      .eq("organization_id", organizationId);
    return profileError ? fail(profileError.message) : ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function reactivateOrganizationAction(
  organizationId: string,
): Promise<ActionResult<null>> {
  try {
    await requirePlatformAdmin();
    const admin = createSupabaseAdminClient();
    if (!admin) return fail("Supabase no configurado");
    const { error: orgError } = await admin
      .from("organizations")
      .update({ is_active: true })
      .eq("id", organizationId)
      .eq("kind", "client");
    return orgError ? fail(orgError.message) : ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function deleteOrganizationAction(
  organizationId: string,
  reason = "Archivada desde Plataforma",
): Promise<ActionResult<null>> {
  try {
    await requirePlatformAdmin();
    const db = await createSupabaseServerClient();
    if (!db) return fail("Supabase no configurado");
    // The RPC archives the organization and its memberships by recording archived_at.
    const { error } = await db.rpc("archive_business_organization", {
      target_organization_id: organizationId,
      archive_reason: reason.trim(),
    });
    return error ? fail(error.message) : ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
