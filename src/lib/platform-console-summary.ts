import type { PlatformOrganizationRow } from "@/lib/auth/types";

export function summarizePlatformOrganizations(
  organizations: PlatformOrganizationRow[],
) {
  return organizations.reduce(
    (summary, organization) => ({
      total: summary.total + 1,
      active: summary.active + Number(organization.is_active),
      inactive: summary.inactive + Number(!organization.is_active),
      users: summary.users + organization.user_count,
      warehouses: summary.warehouses + organization.warehouse_count,
    }),
    { total: 0, active: 0, inactive: 0, users: 0, warehouses: 0 },
  );
}

export function formatPlatformUserCount(count: number) {
  return count === 1 ? "1 usuario" : `${count} usuarios`;
}

export function formatPlatformWarehouseCount(count: number) {
  return count === 1 ? "1 bodega" : `${count} bodegas`;
}

export function formatPlatformExtraUserLimit(maxUsers: number | null) {
  if (maxUsers === null) return "Sin límite de usuarios";
  return maxUsers === 1 ? "1 usuario extra" : `${maxUsers} usuarios extra`;
}

export function formatPlatformWarehouseLimit(maxWarehouses: number | null) {
  if (maxWarehouses === null) return "Sin límite de bodegas";
  return maxWarehouses === 1
    ? "1 bodega permitida"
    : `${maxWarehouses} bodegas permitidas`;
}
