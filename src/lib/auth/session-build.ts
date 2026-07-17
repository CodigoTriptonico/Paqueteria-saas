import type { OrganizationSettings } from "@/lib/organizations/settings";
import { readMaxWarehouses } from "@/lib/organizations/settings";
import type { AppSession, PermissionKey, RoleSlug } from "@/lib/auth/types";

export type ProfileSessionInput = {
  userId: string;
  email: string;
  fullName: string;
  organizationId: string;
  defaultWarehouseId: string | null;
  roleSlug: RoleSlug;
  roleName: string;
  homeOrganizationName: string;
  homeOrganizationSettings: OrganizationSettings | null | undefined;
  permissions: PermissionKey[];
  warehouseIds: string[];
  isPlatformAdmin: boolean;
};

export function extractPermissionKeys(
  grantedPerms:
    | {
        permissions: { key: PermissionKey } | { key: PermissionKey }[] | null;
      }[]
    | null,
): PermissionKey[] {
  return (grantedPerms || [])
    .map((row) => {
      const perm = row.permissions;
      return Array.isArray(perm) ? perm[0]?.key : perm?.key;
    })
    .filter(Boolean) as PermissionKey[];
}

/** A session is always scoped to the organization assigned to its profile. */
export function buildAppSessionFromProfile(
  home: ProfileSessionInput,
): AppSession {
  return {
    userId: home.userId,
    email: home.email,
    fullName: home.fullName,
    organizationId: home.organizationId,
    organizationName: home.homeOrganizationName,
    multiWarehouseEnabled: Boolean(
      home.homeOrganizationSettings?.multi_warehouse_enabled,
    ),
    maxWarehouses: readMaxWarehouses(home.homeOrganizationSettings),
    roleSlug: home.roleSlug,
    roleName: home.roleName,
    permissions: home.permissions,
    warehouseIds: home.warehouseIds,
    preferredWarehouseId: home.defaultWarehouseId,
    isPlatformAdmin: home.isPlatformAdmin,
  };
}
