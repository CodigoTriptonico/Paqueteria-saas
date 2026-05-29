"use server";

import { requirePlatformAdmin } from "@/lib/auth/platform";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import type { PlatformOrganizationRow, PlatformOrgUserRow, RoleSlug } from "@/lib/auth/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";

function slugify(name: string) {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function listAllOrganizationsAction(): Promise<ActionResult<PlatformOrganizationRow[]>> {
  try {
    await requirePlatformAdmin();

    const admin = createSupabaseAdminClient();
    if (!admin) {
      return fail("Supabase no configurado");
    }

    const { data: orgs, error } = await admin
      .from("organizations")
      .select("id, name, slug, is_active, created_at")
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

    const rows: PlatformOrganizationRow[] = (orgs || []).map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      is_active: org.is_active,
      created_at: org.created_at,
      user_count: userCount.get(org.id) || 0,
      warehouse_count: warehouseCount.get(org.id) || 0,
    }));

    return ok(rows);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function createOrganizationAction(input: {
  name: string;
  slug?: string;
  adminEmail: string;
  adminPassword: string;
  adminFullName?: string;
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
    const orgSlug = (input.slug?.trim() || slugify(orgName)).slice(0, 80);

    if (!orgName || !input.adminEmail.trim() || input.adminPassword.length < 6) {
      return fail("Nombre, email y contraseña (mín. 6) son obligatorios");
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: input.adminEmail.trim(),
      password: input.adminPassword,
      email_confirm: true,
    });

    if (createError || !created.user) {
      return fail(createError?.message || "No se pudo crear el usuario administrador");
    }

    const { data: orgId, error: bootstrapError } = await admin.rpc("bootstrap_organization", {
      org_name: orgName,
      owner_id: created.user.id,
      owner_email: input.adminEmail.trim(),
      owner_name: input.adminFullName?.trim() || null,
      org_slug: orgSlug || null,
    });

    if (bootstrapError || !orgId) {
      return fail(bootstrapError?.message || "No se pudo crear la organización");
    }

    return ok({ organizationId: orgId as string });
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

    const { error: orgError } = await admin
      .from("organizations")
      .update({ is_active: false })
      .eq("id", organizationId);

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
      return fail(profileError.message);
    }

    return ok({ userId: created.user.id });
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
