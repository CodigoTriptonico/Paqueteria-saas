import { redirect } from "next/navigation";
import {
  canAccessPath,
  platformAdminNeedsClientContext,
  sessionHasPermission,
} from "@/lib/auth/permissions";
import { getAppSession } from "@/lib/auth/session";
import type { PermissionKey } from "@/lib/auth/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function requirePermission(permission: PermissionKey, redirectTo = "/") {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const session = await getAppSession();

  if (!session) {
    redirect("/login");
  }

  if (!sessionHasPermission(session, permission)) {
    redirect(redirectTo);
  }

  return session;
}

export async function requirePathAccess(pathname: string) {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const session = await getAppSession();

  if (!session) {
    redirect("/login");
  }

  if (!canAccessPath(session, pathname)) {
    if (platformAdminNeedsClientContext(session)) {
      redirect("/platform");
    }
    redirect("/");
  }

  return session;
}

export async function requirePlatformPathAccess() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const session = await getAppSession();

  if (!session) {
    redirect("/login");
  }

  if (!session.isPlatformAdmin) {
    redirect("/");
  }

  return session;
}
