import type { AppSession } from "@/lib/auth/types";
import { sessionHasPermission } from "@/lib/auth/permissions";

export function canReadDriverAgencyVisits(
  session: AppSession,
  requestedDriverId: string,
) {
  if (!requestedDriverId.trim()) {
    return false;
  }
  if (session.roleSlug === "conductor") {
    return session.userId === requestedDriverId;
  }
  return sessionHasPermission(session, "routes.view");
}
