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
  | "routes.view"
  | "routes.update_status";

export type RoleSlug = "administrador" | "vendedor" | "conductor";

export type AppSession = {
  userId: string;
  email: string;
  fullName: string | null;
  organizationId: string;
  organizationName: string;
  multiWarehouseEnabled: boolean;
  roleSlug: RoleSlug;
  roleName: string;
  permissions: PermissionKey[];
  warehouseIds: string[];
  isPlatformAdmin: boolean;
};

export type PlatformOrganizationRow = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  user_count: number;
  warehouse_count: number;
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
};

export type PermissionRow = {
  id: string;
  key: PermissionKey;
  name: string;
  description: string | null;
};
