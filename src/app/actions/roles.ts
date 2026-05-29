"use server";

import { requireAppSession } from "@/lib/auth/session";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import type { PermissionKey, PermissionRow, RoleRow } from "@/lib/auth/types";

export type RolePermissionState = {
  roleId: string;
  permissionId: string;
  key: PermissionKey;
  granted: boolean;
};

export async function listRolesAndPermissionsAction(): Promise<
  ActionResult<{
    roles: RoleRow[];
    permissions: PermissionRow[];
    rolePermissions: RolePermissionState[];
  }>
> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "permissions.manage")) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const [{ data: roles, error: rolesError }, { data: permissions, error: permsError }] =
      await Promise.all([
        supabase
          .from("roles")
          .select("id, slug, name")
          .eq("organization_id", session.organizationId)
          .order("name"),
        supabase.from("permissions").select("id, key, name, description").order("name"),
      ]);

    if (rolesError || permsError) {
      return fail(rolesError?.message || permsError?.message || "Error al cargar roles");
    }

    const roleIds = (roles || []).map((role) => role.id);
    const { data: rolePermissions, error: rpError } = await supabase
      .from("role_permissions")
      .select("role_id, permission_id, granted, permissions(key)")
      .in("role_id", roleIds);

    if (rpError) {
      return fail(rpError.message);
    }

    const mapped: RolePermissionState[] = (rolePermissions || []).map((row) => {
      const perm = row.permissions as { key: PermissionKey } | { key: PermissionKey }[];
      const key = Array.isArray(perm) ? perm[0]?.key : perm.key;
      return {
        roleId: row.role_id,
        permissionId: row.permission_id,
        key: key || ("inventory.view" as PermissionKey),
        granted: row.granted,
      };
    });

    return ok({
      roles: (roles || []) as RoleRow[],
      permissions: (permissions || []) as PermissionRow[],
      rolePermissions: mapped,
    });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function setRolePermissionAction(
  roleId: string,
  permissionId: string,
  granted: boolean,
): Promise<ActionResult<null>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "permissions.manage")) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data: role } = await supabase
      .from("roles")
      .select("id")
      .eq("id", roleId)
      .eq("organization_id", session.organizationId)
      .maybeSingle();

    if (!role) {
      return fail("Rol no encontrado");
    }

    const { error } = await supabase.from("role_permissions").upsert({
      role_id: roleId,
      permission_id: permissionId,
      granted,
    });

    if (error) {
      return fail(error.message);
    }

    return ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
