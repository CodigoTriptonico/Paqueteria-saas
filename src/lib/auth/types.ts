export type PermissionKey =
  | "all"
  | "users.manage"
  | "permissions.manage"
  | "warehouses.manage"
  | "settings.manage"
  | "sales.manage"
  | "customers.manage"
  | "inventory.view"
  | "inventory.reserve"
  | "inventory.adjust"
  | "inventory.assign"
  | "inventory.return"
  | "routes.view"
  | "routes.update_status"
  | "time_clock.view"
  | "time_clock.manage"
  | "distribution.manage"
  | "distribution.sell"
  | "distribution.acquire";

export type RoleSlug = "administrador" | "vendedor" | "conductor" | (string & {});

type OrganizationKind = "platform" | "client";

export type AppSession = {
  userId: string;
  email: string;
  fullName: string | null;
  /** Org usada para cargar datos (cliente si estás en vista plataforma). */
  organizationId: string;
  organizationName: string;
  /** Org real del perfil (Boxario / platform). */
  homeOrganizationId: string;
  homeOrganizationName: string;
  /** Cliente seleccionado en /platform, si aplica. */
  actingOrganizationId: string | null;
  actingOrganizationName: string | null;
  isActingAsClient: boolean;
  multiWarehouseEnabled: boolean;
  maxWarehouses: number;
  roleSlug: RoleSlug;
  roleName: string;
  permissions: PermissionKey[];
  warehouseIds: string[];
  preferredWarehouseId: string | null;
  isPlatformAdmin: boolean;
};

export type PlatformOrganizationRow = {
  id: string;
  name: string;
  slug: string;
  kind: OrganizationKind;
  is_active: boolean;
  created_at: string;
  user_count: number;
  warehouse_count: number;
  max_users: number | null;
  max_warehouses: number | null;
};

export type PlatformOrgUserRow = {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  role: { slug: RoleSlug; name: string };
};

export type WarehouseRow = {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
  is_default: boolean;
};

export type RoleRow = {
  id: string;
  slug: RoleSlug;
  name: string;
  isSystem: boolean;
};

export type PermissionRow = {
  id: string;
  key: PermissionKey;
  name: string;
  description: string | null;
};
