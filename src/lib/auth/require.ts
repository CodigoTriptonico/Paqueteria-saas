import { redirect } from "next/navigation";
import {
  canAccessPath,
  platformAdminNeedsClientContext,
} from "@/lib/auth/permissions";
import { getAppSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";


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
