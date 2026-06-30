import type { OrganizationSettings } from "@/lib/organizations/settings";
import { readMaxWarehouses } from "@/lib/organizations/settings";
import type { AppSession, PermissionKey, RoleSlug } from "@/lib/auth/types";

export const PLATFORM_VIEW_PERMISSIONS: PermissionKey[] = [
  "all",
  "users.manage",
  "permissions.manage",
  "warehouses.manage",
  "settings.manage",
  "sales.manage",
  "customers.manage",
  "inventory.view",
  "inventory.reserve",
  "inventory.adjust",
  "routes.view",
  "routes.update_status",
];

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

export type ActingOrganizationInput = {
  id: string;
  name: string;
  settings: OrganizationSettings | null;
};

export function extractPermissionKeys(
  grantedPerms: { permissions: { key: PermissionKey } | { key: PermissionKey }[] | null }[] | null,
): PermissionKey[] {
  return (grantedPerms || [])
    .map((row) => {
      const perm = row.permissions;
      return Array.isArray(perm) ? perm[0]?.key : perm?.key;
    })
    .filter(Boolean) as PermissionKey[];
}

export function resolveActingContext(input: {
  isPlatformAdmin: boolean;
  onPlatformRoute: boolean;
  actAsOrganizationId: string | null;
  actingOrg: ActingOrganizationInput | null;
  home: ProfileSessionInput;
}): Pick<
  AppSession,
  | "organizationId"
  | "organizationName"
  | "actingOrganizationId"
  | "actingOrganizationName"
  | "isActingAsClient"
  | "multiWarehouseEnabled"
  | "maxWarehouses"
  | "roleSlug"
  | "roleName"
  | "permissions"
  | "warehouseIds"
  | "preferredWarehouseId"
> {
  const base = {
    organizationId: input.home.organizationId,
    organizationName: input.home.homeOrganizationName,
    actingOrganizationId: null as string | null,
    actingOrganizationName: null as string | null,
    isActingAsClient: false,
    multiWarehouseEnabled: Boolean(input.home.homeOrganizationSettings?.multi_warehouse_enabled),
    maxWarehouses: readMaxWarehouses(input.home.homeOrganizationSettings),
    roleSlug: input.home.roleSlug,
    roleName: input.home.roleName,
    permissions: input.home.permissions,
    warehouseIds: input.home.warehouseIds,
    preferredWarehouseId: input.home.defaultWarehouseId,
  };

  if (
    !input.isPlatformAdmin ||
    input.onPlatformRoute ||
    !input.actAsOrganizationId ||
    !input.actingOrg
  ) {
    return base;
  }

  return {
    organizationId: input.actingOrg.id,
    organizationName: input.actingOrg.name,
    actingOrganizationId: input.actingOrg.id,
    actingOrganizationName: input.actingOrg.name,
    isActingAsClient: true,
    multiWarehouseEnabled: Boolean(input.actingOrg.settings?.multi_warehouse_enabled),
    maxWarehouses: readMaxWarehouses(input.actingOrg.settings),
    roleSlug: "administrador",
    roleName: "Vista plataforma",
    permissions: PLATFORM_VIEW_PERMISSIONS,
    warehouseIds: [],
    preferredWarehouseId: null,
  };
}

export function buildAppSessionFromProfile(
  home: ProfileSessionInput,
  acting: Pick<
    AppSession,
    | "organizationId"
    | "organizationName"
    | "actingOrganizationId"
    | "actingOrganizationName"
    | "isActingAsClient"
    | "multiWarehouseEnabled"
    | "maxWarehouses"
    | "roleSlug"
    | "roleName"
    | "permissions"
    | "warehouseIds"
    | "preferredWarehouseId"
  >,
): AppSession {
  return {
    userId: home.userId,
    email: home.email,
    fullName: home.fullName,
    homeOrganizationId: home.organizationId,
    homeOrganizationName: home.homeOrganizationName,
    isPlatformAdmin: home.isPlatformAdmin,
    ...acting,
  };
}
