import type { RoleSlug } from "@/lib/auth/types";

export function isAssignableRouteMemberRole(roleSlug: RoleSlug | string) {
  return roleSlug === "conductor";
}
