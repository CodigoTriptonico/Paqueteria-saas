"use server";

import { requireAppSession } from "@/lib/auth/session";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import { parsePlanLimit } from "@/lib/organizations/settings";
import { assertSameOrgWarehouseIds } from "@/lib/security/org-scope";
import { deleteAuthUserSafely } from "@/lib/security/auth-cleanup";
import type { RoleSlug } from "@/lib/auth/types";
import { agencyDemoTeamErrorMessage } from "@/lib/agency-demo-team";

function canManageOrganizationUsers(session: Awaited<ReturnType<typeof requireAppSession>>) {
  return (
    sessionHasPermission(session, "users.manage") ||
    sessionHasPermission(session, "agency.users.manage")
  );
}

export type OrgUserRow = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string;
  additionalPhones: string[];
  createdAt: string;
  is_active: boolean;
  is_current_user: boolean;
  role: { id: string; slug: RoleSlug; name: string };
  warehouses: { id: string; name: string }[];
  defaultWarehouseId: string | null;
};

export async function listOrgUsersAction(): Promise<ActionResult<OrgUserRow[]>> {
  try {
    const session = await requireAppSession();

    if (!canManageOrganizationUsers(session)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, email, full_name, is_active, phone, created_at, default_warehouse_id, roles(id, slug, name), profile_warehouses(warehouse_id, warehouses(id, name)), profile_phones(phone)",
      )
      .eq("organization_id", session.organizationId)
      .order("created_at");

    if (error) {
      return fail(error.message);
    }

    const users: OrgUserRow[] = (data || []).map((row) => {
      const roleRow = row.roles as OrgUserRow["role"] | OrgUserRow["role"][];
      const role = Array.isArray(roleRow) ? roleRow[0] : roleRow;
      const warehouseLinks =
        (row.profile_warehouses as unknown as { warehouses: { id: string; name: string } }[]) ||
        [];
      const extraPhoneRows =
        (row.profile_phones as unknown as { phone: string }[] | { phone: string } | null) ||
        [];
      const extraPhones = (Array.isArray(extraPhoneRows) ? extraPhoneRows : [extraPhoneRows])
        .map((entry) => entry?.phone?.trim())
        .filter(Boolean) as string[];

      return {
        id: row.id,
        email: row.email,
        full_name: row.full_name,
        phone: (row.phone as string | null)?.trim() || "",
        additionalPhones: extraPhones,
        createdAt: row.created_at as string,
        is_active: row.is_active,
        is_current_user: row.id === session.userId || row.email === session.email,
        role: role || { id: "", slug: "vendedor", name: "Vendedor" },
        warehouses: warehouseLinks.map((link) => link.warehouses).filter(Boolean),
        defaultWarehouseId: (row.default_warehouse_id as string | null) || null,
      };
    });

    return ok(users);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export type InventoryMemberRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: { slug: RoleSlug; name: string };
};

export async function listOrgMembersForInventoryAction(): Promise<
  ActionResult<InventoryMemberRow[]>
> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "inventory.view")) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, is_active, roles(slug, name)")
      .eq("organization_id", session.organizationId)
      .eq("is_active", true)
      .order("full_name");

    if (error) {
      return fail(error.message);
    }

    const members: InventoryMemberRow[] = (data || []).map((row) => {
      const roleRow = row.roles as InventoryMemberRow["role"] | InventoryMemberRow["role"][];
      const role = Array.isArray(roleRow) ? roleRow[0] : roleRow;

      return {
        id: row.id,
        email: row.email,
        full_name: row.full_name,
        role: role || { slug: "vendedor", name: "Vendedor" },
      };
    });

    return ok(members);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function inviteOrgUserAction(input: {
  email: string;
  password: string;
  fullName?: string;
  roleSlug: RoleSlug;
  warehouseIds: string[];
  defaultWarehouseId?: string | null;
}): Promise<ActionResult<{ userId: string }>> {
  try {
    const session = await requireAppSession();

    if (!canManageOrganizationUsers(session)) {
      throw new Error("FORBIDDEN");
    }

    const admin = createSupabaseAdminClient();
    const supabase = await createScopedSupabase(session);

    if (!admin || !supabase) {
      return fail("Supabase no configurado");
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", session.organizationId)
      .single();

    const maxUsers = parsePlanLimit(
      (org?.settings as { max_users?: number | string } | null)?.max_users,
    );

    if (maxUsers !== null) {
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", session.organizationId);

      if (Math.max(0, (count || 0) - 1) >= maxUsers) {
        return fail(
          `Límite de usuarios alcanzado (${maxUsers} adicional${maxUsers === 1 ? "" : "es"}). Contacte al administrador.`,
        );
      }
    }

    const { data: role, error: roleError } = await supabase
      .from("roles")
      .select("id")
      .eq("organization_id", session.organizationId)
      .eq("slug", input.roleSlug)
      .single();

    if (roleError || !role) {
      return fail("Rol no encontrado");
    }

    await assertSameOrgWarehouseIds(admin, session.organizationId, input.warehouseIds);

    let createdUserId: string | null = null;

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: input.email.trim(),
      password: input.password,
      email_confirm: true,
    });

    if (createError || !created.user) {
      return fail(createError?.message || "No se pudo crear el usuario");
    }

    createdUserId = created.user.id;

    const { error: profileError } = await admin.from("profiles").insert({
      id: created.user.id,
      organization_id: session.organizationId,
      email: input.email.trim(),
      full_name: input.fullName?.trim() || null,
      role_id: role.id,
      is_active: true,
    });

    if (profileError) {
      await deleteAuthUserSafely(admin, createdUserId);
      return fail(agencyDemoTeamErrorMessage(profileError.message));
    }

    if (input.warehouseIds.length) {
      const { error: whError } = await admin.from("profile_warehouses").insert(
        input.warehouseIds.map((warehouseId) => ({
          profile_id: created.user.id,
          warehouse_id: warehouseId,
        })),
      );

      if (whError) {
        await deleteAuthUserSafely(admin, createdUserId);
        return fail(whError.message);
      }
    }

    let defaultWarehouseId = input.defaultWarehouseId ?? null;

    if (defaultWarehouseId && !input.warehouseIds.includes(defaultWarehouseId)) {
      defaultWarehouseId = null;
    }

    if (!defaultWarehouseId && input.warehouseIds.length === 1) {
      defaultWarehouseId = input.warehouseIds[0];
    }

    if (defaultWarehouseId) {
      const { error: defaultError } = await admin
        .from("profiles")
        .update({ default_warehouse_id: defaultWarehouseId })
        .eq("id", created.user.id);

      if (defaultError) {
        await deleteAuthUserSafely(admin, createdUserId);
        return fail(defaultError.message);
      }
    }

    return ok({ userId: created.user.id });
  } catch (error) {
    return fail(agencyDemoTeamErrorMessage(actionErrorMessage(error)));
  }
}

export async function updateOrgUserAction(input: {
  userId: string;
  roleSlug?: RoleSlug;
  warehouseIds?: string[];
  defaultWarehouseId?: string | null;
  isActive?: boolean;
  fullName?: string;
}): Promise<ActionResult<null>> {
  try {
    const session = await requireAppSession();

    if (!canManageOrganizationUsers(session)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    const admin = createSupabaseAdminClient();

    if (!supabase || !admin) {
      return fail("Supabase no configurado");
    }

    if (input.userId === session.userId && input.isActive === false) {
      return fail("No puedes desactivarte a ti mismo");
    }

    if (input.userId === session.userId && input.roleSlug && input.roleSlug !== session.roleSlug) {
      return fail("No puedes cambiar tu propio rol");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role_id")
      .eq("id", input.userId)
      .eq("organization_id", session.organizationId)
      .maybeSingle();

    if (!profile) {
      return fail("Usuario no encontrado");
    }

    const updates: Record<string, unknown> = {};

    if (input.fullName !== undefined) {
      updates.full_name = input.fullName.trim() || null;
    }

    if (input.isActive !== undefined) {
      updates.is_active = input.isActive;
    }

    if (input.roleSlug) {
      const { data: role } = await supabase
        .from("roles")
        .select("id")
        .eq("organization_id", session.organizationId)
        .eq("slug", input.roleSlug)
        .single();

      if (!role) {
        return fail("Rol no encontrado");
      }

      updates.role_id = role.id;
    }

    if (Object.keys(updates).length) {
      const { error } = await supabase.from("profiles").update(updates).eq("id", input.userId);

      if (error) {
        return fail(agencyDemoTeamErrorMessage(error.message));
      }
    }

    if (input.warehouseIds) {
      await assertSameOrgWarehouseIds(admin, session.organizationId, input.warehouseIds);

      await admin.from("profile_warehouses").delete().eq("profile_id", input.userId);

      if (input.warehouseIds.length) {
        const { error: whError } = await admin.from("profile_warehouses").insert(
          input.warehouseIds.map((warehouseId) => ({
            profile_id: input.userId,
            warehouse_id: warehouseId,
          })),
        );

        if (whError) {
          return fail(whError.message);
        }
      }

      let defaultWarehouseId = input.defaultWarehouseId ?? null;

      if (defaultWarehouseId && !input.warehouseIds.includes(defaultWarehouseId)) {
        defaultWarehouseId = null;
      }

      if (!defaultWarehouseId && input.warehouseIds.length === 1) {
        defaultWarehouseId = input.warehouseIds[0];
      }

      const { error: defaultError } = await supabase
        .from("profiles")
        .update({ default_warehouse_id: defaultWarehouseId })
        .eq("id", input.userId);

      if (defaultError) {
        return fail(defaultError.message);
      }
    } else if (input.defaultWarehouseId !== undefined) {
      const { error: defaultError } = await supabase
        .from("profiles")
        .update({ default_warehouse_id: input.defaultWarehouseId })
        .eq("id", input.userId);

      if (defaultError) {
        return fail(defaultError.message);
      }
    }

    return ok(null);
  } catch (error) {
    return fail(agencyDemoTeamErrorMessage(actionErrorMessage(error)));
  }
}
