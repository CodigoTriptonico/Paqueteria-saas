"use server";

import { requireAppSession } from "@/lib/auth/session";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import type { RoleSlug } from "@/lib/auth/types";

export type OrgUserRow = {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  role: { id: string; slug: RoleSlug; name: string };
  warehouses: { id: string; name: string }[];
};

export async function listOrgUsersAction(): Promise<ActionResult<OrgUserRow[]>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "users.manage")) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, email, full_name, is_active, roles(id, slug, name), profile_warehouses(warehouse_id, warehouses(id, name))",
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

      return {
        id: row.id,
        email: row.email,
        full_name: row.full_name,
        is_active: row.is_active,
        role: role || { id: "", slug: "vendedor", name: "Vendedor" },
        warehouses: warehouseLinks.map((link) => link.warehouses).filter(Boolean),
      };
    });

    return ok(users);
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
}): Promise<ActionResult<{ userId: string }>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "users.manage")) {
      throw new Error("FORBIDDEN");
    }

    const admin = createSupabaseAdminClient();
    const supabase = await createSupabaseServerClient();

    if (!admin || !supabase) {
      return fail("Supabase no configurado");
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
      organization_id: session.organizationId,
      email: input.email.trim(),
      full_name: input.fullName?.trim() || null,
      role_id: role.id,
      is_active: true,
    });

    if (profileError) {
      return fail(profileError.message);
    }

    if (input.warehouseIds.length) {
      const { error: whError } = await admin.from("profile_warehouses").insert(
        input.warehouseIds.map((warehouseId) => ({
          profile_id: created.user.id,
          warehouse_id: warehouseId,
        })),
      );

      if (whError) {
        return fail(whError.message);
      }
    }

    return ok({ userId: created.user.id });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function updateOrgUserAction(input: {
  userId: string;
  roleSlug?: RoleSlug;
  warehouseIds?: string[];
  isActive?: boolean;
  fullName?: string;
}): Promise<ActionResult<null>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "users.manage")) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createSupabaseServerClient();
    const admin = createSupabaseAdminClient();

    if (!supabase || !admin) {
      return fail("Supabase no configurado");
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
        return fail(error.message);
      }
    }

    if (input.warehouseIds) {
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
    }

    return ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
