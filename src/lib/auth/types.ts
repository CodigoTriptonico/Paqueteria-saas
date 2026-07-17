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
  | "distribution.acquire"
  | "agency.view"
  | "agency.create"
  | "agency.edit"
  | "agency.status.transition"
  | "agency.captor.assign"
  | "agency.supervisor.assign"
  | "agency.support"
  | "agency.users.view"
  | "agency.users.manage"
  | "agency.pricing.view"
  | "agency.pricing.manage"
  | "agency.sales.view"
  | "agency.sales.create"
  | "agency.customers.manage"
  | "agency.requests.view"
  | "agency.requests.create"
  | "agency.requests.edit"
  | "agency.requests.assign"
  | "agency.requests.confirm"
  | "agency.visits.view"
  | "agency.visits.confirm"
  | "agency.account.view"
  | "agency.account.charge"
  | "agency.account.payment"
  | "agency.account.apply"
  | "agency.customer_finance.view"
  | "agency.customer_finance.collect"
  | "accounting.view"
  | "accounting.post"
  | "accounting.reconcile"
  | "accounting.reverse"
  | "financial_hold.view"
  | "financial_hold.release"
  | "financial_hold.release_manual"
  | "audit.immutable.view";

export type RoleSlug = "administrador" | "vendedor" | "conductor" | (string & {});

type OrganizationKind = "platform" | "client";

export type AppSession = {
  userId: string;
  email: string;
  fullName: string | null;
  /** Org usada para cargar datos (cliente si estás en vista plataforma). */
  organizationId: string;
  organizationName: string;
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
