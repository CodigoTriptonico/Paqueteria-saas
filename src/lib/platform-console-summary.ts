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
