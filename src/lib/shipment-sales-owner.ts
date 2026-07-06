import type { RoleSlug } from "@/lib/auth/types";

export function shipmentOwnershipInsert(userId: string) {
  return {
    created_by: userId,
    sales_owner_id: userId,
  };
}

export function isSalesOwnerRole(roleSlug: RoleSlug | string | null | undefined) {
  return roleSlug === "administrador" || roleSlug === "vendedor";
}
