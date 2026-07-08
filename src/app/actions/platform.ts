"use server";

import { requirePlatformAdmin } from "@/lib/auth/platform";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import type { PlatformOrganizationRow, PlatformOrgUserRow, RoleSlug } from "@/lib/auth/types";
import { canDeactivateOrganization, isClientOrganization } from "@/lib/organizations/kind";
import type { SupabaseClient } from "@supabase/supabase-js";
import { slugifyOrgName } from "@/lib/organizations/slug";
import { isValidNationalPhone } from "@/lib/phone/countries";
import { normalizePhoneDigits, normalizePhoneE164 } from "@/lib/phone/normalize";
import { assertPhoneAvailable } from "@/lib/phone/profile-phone";
import { syncProfileRecoveryPhones } from "@/lib/phone/profile-phones";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { parsePlanLimit, type OrganizationSettings } from "@/lib/organizations/settings";
import { deleteAuthUserSafely } from "@/lib/security/auth-cleanup";

export async function listAllOrganizationsAction(): Promise<ActionResult<PlatformOrganizationRow[]>> {
  try {
    await requirePlatformAdmin();

    const admin = createSupabaseAdminClient();
    if (!admin) {
      return fail("Supabase no configurado");
    }

    const { data: orgs, error } = await admin
      .from("organizations")
      .select("id, name, slug, kind, is_active, created_at, settings")
      .eq("kind", "client")
      .order("created_at", { ascending: false });

    if (error) {
      return fail(error.message);
    }

    const { data: profiles } = await admin.from("profiles").select("id, organization_id");
    const { data: warehouses } = await admin.from("warehouses").select("id, organization_id");

    const userCount = new Map<string, number>();
    const warehouseCount = new Map<string, number>();

    for (const row of profiles || []) {
      userCount.set(row.organization_id, (userCount.get(row.organization_id) || 0) + 1);
    }

    for (const row of warehouses || []) {
      warehouseCount.set(row.organization_id, (warehouseCount.get(row.organization_id) || 0) + 1);
    }

    const rows: PlatformOrganizationRow[] = (orgs || [])
      .filter((org) => isClientOrganization(org.kind))
      .map((org) => {
        const settings = (org.settings || {}) as OrganizationSettings;

        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          kind: org.kind === "platform" ? "platform" : "client",
          is_active: org.is_active,
          created_at: org.created_at,
          user_count: userCount.get(org.id) || 0,
          warehouse_count: warehouseCount.get(org.id) || 0,
          max_users: parsePlanLimit(settings.max_users),
          max_warehouses: parsePlanLimit(settings.max_warehouses),
        };
      });

    return ok(rows);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

function normalizeContactList(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

export async function createOrganizationAction(input: {
  name: string;
  slug?: string;
  adminEmail: string;
  adminPassword: string;
  adminFullName?: string;
  adminPhones: string[];
  settings?: {
    maxUsers?: number;
    maxWarehouses?: number;
  };
}): Promise<ActionResult<{ organizationId: string }>> {
  try {
    await requirePlatformAdmin();

    if (!isSupabaseConfigured()) {
      return fail("Supabase no configurado");
    }

    const admin = createSupabaseAdminClient();
    if (!admin) {
      return fail("Supabase no configurado");
    }

    const orgName = input.name.trim();
    const orgSlug = (input.slug?.trim() || slugifyOrgName(orgName)).slice(0, 80);
    const primaryEmail = input.adminEmail.trim().toLowerCase();
    const adminPhones = normalizeContactList(input.adminPhones);
    const primaryPhone = adminPhones[0] ?? "";
    const adminPhoneE164 = normalizePhoneE164(primaryPhone);

    if (!orgName || !primaryEmail || input.adminPassword.length < 6) {
      return fail("Completa nombre de paquetería, correo del dueño y contraseña (mín. 6 caracteres).");
    }

    if (!adminPhoneE164 || !isValidNationalPhone(primaryPhone)) {
      return fail("Ingresa un número de celular válido para el país seleccionado.");
    }

    for (const phone of adminPhones) {
      if (!isValidNationalPhone(phone)) {
        return fail("Uno de los celulares adicionales no es válido.");
      }

      const phoneConflict = await assertPhoneAvailable(admin, phone);
      if (phoneConflict) {
        return fail(phoneConflict);
      }
    }

    const uniquePhoneDigits = new Set(adminPhones.map((phone) => normalizePhoneDigits(phone)));
    if (uniquePhoneDigits.size !== adminPhones.length) {
      return fail("No repitas números de celular del dueño.");
    }

    const { data: slugConflict } = await admin
      .from("organizations")
      .select("id")
      .eq("slug", orgSlug)
      .maybeSingle();

    if (slugConflict) {
      return fail("Ya existe una paquetería con ese nombre. Usa otro nombre comercial.");
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: primaryEmail,
      password: input.adminPassword,
      email_confirm: true,
    });

    if (createError || !created.user) {
      return fail(createError?.message || "No se pudo crear el usuario administrador");
    }

    const { data: orgId, error: bootstrapError } = await admin.rpc("bootstrap_organization", {
      org_name: orgName,
      owner_id: created.user.id,
      owner_email: primaryEmail,
      owner_name: input.adminFullName?.trim() || null,
      org_slug: orgSlug || null,
      org_kind: "client",
      owner_phone: adminPhoneE164,
    });

    if (bootstrapError || !orgId) {
      await deleteAuthUserSafely(admin, created.user.id);
      return fail(bootstrapError?.message || "No se pudo crear la organización");
    }

    const maxUsers = Math.max(1, Math.min(500, Math.trunc(input.settings?.maxUsers || 5)));
    const maxWarehouses = Math.max(1, Math.min(100, Math.trunc(input.settings?.maxWarehouses || 5)));
    const { data: existingOrg } = await admin
      .from("organizations")
      .select("settings")
      .eq("id", orgId as string)
      .single();

    const { error: settingsError } = await admin
      .from("organizations")
      .update({
        settings: {
          ...((existingOrg?.settings as Record<string, unknown> | undefined) || {}),
          multi_warehouse_enabled: maxWarehouses > 1,
          max_users: maxUsers,
          max_warehouses: maxWarehouses,
          owner_contact_phones: adminPhones.map(
            (phone) => normalizePhoneE164(phone) || phone.trim(),
          ),
        },
      })
      .eq("id", orgId as string);

    if (settingsError) {
      return fail(settingsError.message);
    }

    try {
      await syncProfileRecoveryPhones(
        admin,
        created.user.id,
        adminPhones.map((phone) => normalizePhoneE164(phone) || phone.trim()),
      );

      if (adminPhoneE164) {
        await admin.auth.admin.updateUserById(created.user.id, {
          phone: adminPhoneE164,
          phone_confirm: true,
        });
      }
    } catch (phoneSyncError) {
      return fail(actionErrorMessage(phoneSyncError));
    }

    return ok({ organizationId: orgId as string });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function updateOrganizationAction(input: {
  organizationId: string;
  name: string;
  slug?: string;
  maxUsers?: number;
  maxWarehouses?: number;
}): Promise<ActionResult<null>> {
  try {
    await requirePlatformAdmin();

    const admin = createSupabaseAdminClient();
    if (!admin) {
      return fail("Supabase no configurado");
    }

    const orgName = input.name.trim();
    const orgSlug = (input.slug?.trim() || slugifyOrgName(orgName)).slice(0, 80);

    if (!orgName || !orgSlug) {
      return fail("Nombre y slug son obligatorios");
    }

    const { data: org } = await admin
      .from("organizations")
      .select("settings")
      .eq("id", input.organizationId)
      .eq("kind", "client")
      .single();

    const currentSettings = (org?.settings || {}) as OrganizationSettings;
    const nextSettings: OrganizationSettings = {
      ...currentSettings,
    };

    if (input.maxWarehouses !== undefined) {
      const { count: warehouseCount } = await admin
        .from("warehouses")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", input.organizationId);

      const minWarehouses = warehouseCount || 0;
      const maxWarehouses = Math.max(
        minWarehouses,
        Math.max(1, Math.min(100, Math.trunc(input.maxWarehouses))),
      );
      nextSettings.max_warehouses = maxWarehouses;
      nextSettings.multi_warehouse_enabled = maxWarehouses > 1;
    }

    if (input.maxUsers !== undefined) {
      const minExtraUsers = Math.max(
        0,
        (
          await admin
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", input.organizationId)
        ).count || 0,
      ) - 1;
      nextSettings.max_users = Math.max(
        minExtraUsers,
        Math.max(1, Math.min(500, Math.trunc(input.maxUsers))),
      );
    }

    const { error } = await admin
      .from("organizations")
      .update({
        name: orgName,
        slug: orgSlug,
        settings: nextSettings,
      })
      .eq("id", input.organizationId)
      .eq("kind", "client");

    if (error) {
      return fail(error.message);
    }

    return ok(null);
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
    if (!admin) {
      return fail("Supabase no configurado");
    }

    const { data: org, error: orgLookupError } = await admin
      .from("organizations")
      .select("kind")
      .eq("id", organizationId)
      .single();

    if (orgLookupError || !org) {
      return fail(orgLookupError?.message || "Empresa no encontrada");
    }

    if (!canDeactivateOrganization(org.kind)) {
      return fail("No se puede desactivar la organización de plataforma");
    }

    const { error: orgError } = await admin
      .from("organizations")
      .update({ is_active: false })
      .eq("id", organizationId)
      .eq("kind", "client");

    if (orgError) {
      return fail(orgError.message);
    }

    const { error: profileError } = await admin
      .from("profiles")
      .update({ is_active: false })
      .eq("organization_id", organizationId);

    if (profileError) {
      return fail(profileError.message);
    }

    return ok(null);
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
    if (!admin) {
      return fail("Supabase no configurado");
    }

    const { error } = await admin
      .from("organizations")
      .update({ is_active: true })
      .eq("id", organizationId);

    if (error) {
      return fail(error.message);
    }

    return ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function listOrganizationUsersAction(
  organizationId: string,
): Promise<ActionResult<PlatformOrgUserRow[]>> {
  try {
    await requirePlatformAdmin();

    const admin = createSupabaseAdminClient();
    if (!admin) {
      return fail("Supabase no configurado");
    }

    const { data, error } = await admin
      .from("profiles")
      .select("id, email, full_name, is_active, roles(slug, name)")
      .eq("organization_id", organizationId)
      .order("created_at");

    if (error) {
      return fail(error.message);
    }

    const users: PlatformOrgUserRow[] = (data || []).map((row) => {
      const roleRow = row.roles as { slug: RoleSlug; name: string } | { slug: RoleSlug; name: string }[];
      const role = Array.isArray(roleRow) ? roleRow[0] : roleRow;

      return {
        id: row.id,
        email: row.email,
        full_name: row.full_name,
        is_active: row.is_active,
        role: role || { slug: "vendedor", name: "Vendedor" },
      };
    });

    return ok(users);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function createOrgUserAsPlatformAdminAction(input: {
  organizationId: string;
  email: string;
  password: string;
  fullName?: string;
  roleSlug: RoleSlug;
}): Promise<ActionResult<{ userId: string }>> {
  try {
    await requirePlatformAdmin();

    const admin = createSupabaseAdminClient();
    if (!admin) {
      return fail("Supabase no configurado");
    }

    const { data: org } = await admin
      .from("organizations")
      .select("settings")
      .eq("id", input.organizationId)
      .single();

    const maxUsers = Number((org?.settings as { max_users?: number } | null)?.max_users || 0);
    if (maxUsers > 0) {
      const { count } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", input.organizationId);

      if (Math.max(0, (count || 0) - 1) >= maxUsers) {
        return fail(`Esta paquetería llegó al límite de ${maxUsers} usuarios extra.`);
      }
    }

    const { data: role, error: roleError } = await admin
      .from("roles")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("slug", input.roleSlug)
      .single();

    if (roleError || !role) {
      return fail("Rol no encontrado en la empresa");
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: input.email.trim(),
      password: input.password,
      email_confirm: true,
    });

    if (createError || !created.user) {
      return fail(createError?.message || "No se pudo crear el usuario");
    }

    const { error: profileError } = await admin.from("profiles").insert({
      id: created.user.id,
      organization_id: input.organizationId,
      email: input.email.trim(),
      full_name: input.fullName?.trim() || null,
      role_id: role.id,
      is_active: true,
    });

    if (profileError) {
      await deleteAuthUserSafely(admin, created.user.id);
      return fail(profileError.message);
    }

    return ok({ userId: created.user.id });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

async function clearProfileReferences(admin: SupabaseClient, profileId: string) {
  const { error: shipmentsError } = await admin
    .from("shipments")
    .update({ assigned_to: null })
    .eq("assigned_to", profileId);

  if (shipmentsError) {
    throw new Error(shipmentsError.message);
  }

  const { error: movementsError } = await admin
    .from("inventory_movements")
    .update({ created_by: null })
    .eq("created_by", profileId);

  if (movementsError) {
    throw new Error(movementsError.message);
  }
}

async function deleteAuthUser(admin: SupabaseClient, userId: string) {
  await clearProfileReferences(admin, userId);

  const { error } = await admin.auth.admin.deleteUser(userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteOrgUserAsPlatformAdminAction(input: {
  organizationId: string;
  userId: string;
}): Promise<ActionResult<null>> {
  try {
    await requirePlatformAdmin();

    const admin = createSupabaseAdminClient();
    if (!admin) {
      return fail("Supabase no configurado");
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id")
      .eq("id", input.userId)
      .eq("organization_id", input.organizationId)
      .maybeSingle();

    if (profileError) {
      return fail(profileError.message);
    }

    if (!profile) {
      return fail("Usuario no encontrado en esta paquetería");
    }

    await deleteAuthUser(admin, input.userId);

    return ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function deleteOrganizationAction(
  organizationId: string,
): Promise<ActionResult<null>> {
  try {
    await requirePlatformAdmin();

    const admin = createSupabaseAdminClient();
    if (!admin) {
      return fail("Supabase no configurado");
    }

    const { data: org, error: orgLookupError } = await admin
      .from("organizations")
      .select("kind")
      .eq("id", organizationId)
      .single();

    if (orgLookupError || !org) {
      return fail(orgLookupError?.message || "Empresa no encontrada");
    }

    if (!isClientOrganization(org.kind)) {
      return fail("No se puede eliminar la organización de plataforma");
    }

    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("id")
      .eq("organization_id", organizationId);

    if (profilesError) {
      return fail(profilesError.message);
    }

    for (const profile of profiles || []) {
      await deleteAuthUser(admin, profile.id);
    }

    const { error: orgDeleteError } = await admin
      .from("organizations")
      .delete()
      .eq("id", organizationId)
      .eq("kind", "client");

    if (orgDeleteError) {
      return fail(orgDeleteError.message);
    }

    return ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function updateOrgUserAsPlatformAdminAction(input: {
  organizationId: string;
  userId: string;
  isActive?: boolean;
  roleSlug?: RoleSlug;
  fullName?: string;
}): Promise<ActionResult<null>> {
  try {
    await requirePlatformAdmin();

    const admin = createSupabaseAdminClient();
    if (!admin) {
      return fail("Supabase no configurado");
    }

    const updates: Record<string, unknown> = {};

    if (input.fullName !== undefined) {
      updates.full_name = input.fullName.trim() || null;
    }

    if (input.isActive !== undefined) {
      updates.is_active = input.isActive;
    }

    if (input.roleSlug) {
      const { data: role } = await admin
        .from("roles")
        .select("id")
        .eq("organization_id", input.organizationId)
        .eq("slug", input.roleSlug)
        .single();

      if (!role) {
        return fail("Rol no encontrado");
      }

      updates.role_id = role.id;
    }

    if (!Object.keys(updates).length) {
      return ok(null);
    }

    const { error } = await admin
      .from("profiles")
      .update(updates)
      .eq("id", input.userId)
      .eq("organization_id", input.organizationId);

    if (error) {
      return fail(error.message);
    }

    return ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
