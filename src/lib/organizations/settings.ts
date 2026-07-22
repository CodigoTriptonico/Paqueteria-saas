export type OrganizationSettings = {
  agencies_enabled?: boolean;
  multi_warehouse_enabled?: boolean;
  max_warehouses?: number | string;
  max_users?: number | string;
  owner_contact_phones?: string[];
  company_phone?: string;
  company_address?: string;
  company_short_name?: string;
  company_logo_path?: string;
  currency?: string;
  onboarding_dismissed?: boolean;
  onboarding_started?: boolean;
};

/** Plan base de bodegas para cuentas nuevas y orgs sin límite explícito. */
export const DEFAULT_MAX_WAREHOUSES = 3;

/** Plan base de usuarios al crear una empresa desde plataforma. */
export const DEFAULT_MAX_USERS = 5;

export function isAgencyModuleEnabled(
  settings: OrganizationSettings | null | undefined,
): boolean {
  return settings?.agencies_enabled === true;
}

export function parsePlanLimit(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 1) {
    return Math.min(100, Math.trunc(value));
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);

    if (Number.isFinite(parsed) && parsed >= 1) {
      return Math.min(100, Math.trunc(parsed));
    }
  }

  return null;
}

export function getConfiguredWarehouseLimit(
  settings: OrganizationSettings | null | undefined,
): number | null {
  return parsePlanLimit(settings?.max_warehouses);
}

function resolveWarehouseLimit(
  settings: OrganizationSettings | null | undefined,
): number {
  const configured = getConfiguredWarehouseLimit(settings);

  if (configured !== null) {
    return configured;
  }

  return DEFAULT_MAX_WAREHOUSES;
}

export function canEnableMultiWarehouseHub(
  settings: OrganizationSettings | null | undefined,
): boolean {
  const configured = getConfiguredWarehouseLimit(settings);
  return configured !== null && configured >= 2;
}

export function readMaxWarehouses(
  settings: OrganizationSettings | null | undefined,
): number {
  return resolveWarehouseLimit(settings);
}
