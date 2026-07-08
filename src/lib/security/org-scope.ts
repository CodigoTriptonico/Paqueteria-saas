import type { SupabaseClient } from "@supabase/supabase-js";

export class OrgScopeError extends Error {
  constructor(message = "Recurso fuera de la organizacion") {
    super(message);
    this.name = "OrgScopeError";
  }
}

function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids.filter(Boolean)));
}

async function assertSameOrgIds(
  supabase: SupabaseClient,
  orgId: string,
  table: string,
  ids: string[],
  label: string,
) {
  const unique = uniqueIds(ids);
  if (!unique.length) {
    return;
  }

  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("organization_id", orgId)
    .in("id", unique);

  if (error) {
    throw new Error(error.message);
  }

  if ((data || []).length !== unique.length) {
    throw new OrgScopeError(`${label} invalido para la organizacion`);
  }
}

export async function assertSameOrgWarehouseIds(
  supabase: SupabaseClient,
  orgId: string,
  warehouseIds: string[],
) {
  await assertSameOrgIds(supabase, orgId, "warehouses", warehouseIds, "Bodega");
}

export async function assertSameOrgProfileIds(
  supabase: SupabaseClient,
  orgId: string,
  profileIds: string[],
) {
  await assertSameOrgIds(supabase, orgId, "profiles", profileIds, "Usuario");
}

export async function assertSameOrgCustomerIds(
  supabase: SupabaseClient,
  orgId: string,
  customerIds: string[],
) {
  await assertSameOrgIds(supabase, orgId, "customers", customerIds, "Cliente");
}

export async function assertSameOrgRecipientIds(
  supabase: SupabaseClient,
  orgId: string,
  recipientIds: string[],
) {
  await assertSameOrgIds(supabase, orgId, "customer_recipients", recipientIds, "Destinatario");
}
