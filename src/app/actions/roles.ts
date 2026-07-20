"use server";

import { requireAppSession } from "@/lib/auth/session";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import type { PermissionKey, PermissionRow, RoleRow } from "@/lib/auth/types";

export type RolePermissionState = {
  roleId: string;
  permissionId: string;
  key: PermissionKey;
  granted: boolean;
};

function roleSlugFromName(name: string) {
  return name
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function mapRole(row: { id: string; slug: string; name: string; is_system?: boolean }): RoleRow {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    isSystem: row.is_system ?? true,
  };
}

const AGENCY_ROLE_SLUGS = new Set([
  "supervisor_agencias",
  "captador_agencias",
  "administrador_agencia",
  "vendedor_agencia",
  "caja_agencia",
  "operador_agencia",
]);

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

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const [{ data: roles, error: rolesError }, { data: permissions, error: permsError }] =
      await Promise.all([
        supabase
          .from("roles")
          .select("id, slug, name, is_system")
          .eq("organization_id", session.organizationId)
          .order("name"),
        supabase.from("permissions").select("id, key, name, description").order("name"),
      ]);

    if (rolesError || permsError) {
      return fail(rolesError?.message || permsError?.message || "Error al cargar roles");
    }

    const visibleRoles = session.agencyModuleEnabled
      ? roles || []
      : (roles || []).filter((role) => !AGENCY_ROLE_SLUGS.has(role.slug));
    const visiblePermissions = session.agencyModuleEnabled
      ? permissions || []
      : (permissions || []).filter((permission) => !String(permission.key).startsWith("agency."));
    const visiblePermissionIds = new Set(visiblePermissions.map((permission) => permission.id));
    const roleIds = visibleRoles.map((role) => role.id);
    const { data: rolePermissions, error: rpError } = await supabase
      .from("role_permissions")
      .select("role_id, permission_id, granted, permissions(key)")
      .in("role_id", roleIds);

    if (rpError) {
      return fail(rpError.message);
    }

    const mapped: RolePermissionState[] = (rolePermissions || []).filter((row) =>
      visiblePermissionIds.has(row.permission_id),
    ).map((row) => {
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
      roles: visibleRoles.map(mapRole),
      permissions: visiblePermissions as PermissionRow[],
      rolePermissions: mapped,
    });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function createRoleAction(input: {
  name: string;
  copyFromRoleId?: string;
}): Promise<ActionResult<RoleRow>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "permissions.manage")) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const name = input.name.trim();
    const baseSlug = roleSlugFromName(name);

    if (!name || !baseSlug) {
      return fail("Nombre de rol requerido");
    }

    let slug = baseSlug;
    for (let index = 2; index <= 20; index += 1) {
      const { data: existing } = await supabase
        .from("roles")
        .select("id")
        .eq("organization_id", session.organizationId)
        .eq("slug", slug)
        .maybeSingle();

      if (!existing) {
        break;
      }

      slug = `${baseSlug}-${index}`;
    }

    const { data: role, error } = await supabase
      .from("roles")
      .insert({
        organization_id: session.organizationId,
        slug,
        name,
        is_system: false,
      })
      .select("id, slug, name, is_system")
      .single();

    if (error || !role) {
      return fail(error?.message || "No se pudo crear el rol");
    }

    if (input.copyFromRoleId) {
      const { data: copiedPermissions } = await supabase
        .from("role_permissions")
        .select("permission_id, granted")
        .eq("role_id", input.copyFromRoleId);

      if (copiedPermissions?.length) {
        const { error: copyError } = await supabase.from("role_permissions").insert(
          copiedPermissions.map((permission) => ({
            role_id: role.id,
            permission_id: permission.permission_id,
            granted: permission.granted,
          })),
        );

        if (copyError) {
          return fail(copyError.message);
        }
      }
    }

    return ok(mapRole(role));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function updateRoleAction(input: {
  roleId: string;
  name: string;
}): Promise<ActionResult<RoleRow>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "permissions.manage")) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const name = input.name.trim();

    if (!name) {
      return fail("Nombre de rol requerido");
    }

    const { data: current } = await supabase
      .from("roles")
      .select("id, is_system")
      .eq("id", input.roleId)
      .eq("organization_id", session.organizationId)
      .maybeSingle();

    if (!current) {
      return fail("Rol no encontrado");
    }

    if (current.is_system) {
      return fail("No puedes renombrar un rol base");
    }

    const { data, error } = await supabase
      .from("roles")
      .update({ name })
      .eq("id", input.roleId)
      .eq("organization_id", session.organizationId)
      .select("id, slug, name, is_system")
      .single();

    if (error || !data) {
      return fail(error?.message || "No se pudo actualizar el rol");
    }

    return ok(mapRole(data));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function deleteRoleAction(roleId: string): Promise<ActionResult<null>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "permissions.manage")) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data: role } = await supabase
      .from("roles")
      .select("id, is_system")
      .eq("id", roleId)
      .eq("organization_id", session.organizationId)
      .maybeSingle();

    if (!role) {
      return fail("Rol no encontrado");
    }

    if (role.is_system) {
      return fail("No puedes borrar un rol base");
    }

    const { data: users } = await supabase
      .from("profiles")
      .select("id")
      .eq("role_id", roleId)
      .limit(1);

    if (users?.length) {
      return fail("No puedes borrar un rol con usuarios");
    }

    const { error } = await supabase
      .from("roles")
      .delete()
      .eq("id", roleId)
      .eq("organization_id", session.organizationId);

    if (error) {
      return fail(error.message);
    }

    return ok(null);
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

    const supabase = await createScopedSupabase(session);
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

export async function setRolePermissionsBatchAction(
  roleId: string,
  updates: { permissionId: string; granted: boolean }[],
): Promise<ActionResult<null>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "permissions.manage")) {
      throw new Error("FORBIDDEN");
    }

    if (!updates.length) {
      return ok(null);
    }

    const supabase = await createScopedSupabase(session);
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

    const { error } = await supabase.from("role_permissions").upsert(
      updates.map((update) => ({
        role_id: roleId,
        permission_id: update.permissionId,
        granted: update.granted,
      })),
    );

    if (error) {
      return fail(error.message);
    }

    return ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
