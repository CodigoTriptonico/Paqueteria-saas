import { getAppSession, requireAppSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AppSession } from "@/lib/auth/types";

export async function isUserPlatformAdmin(userId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return false;
  }

  const { data } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  return Boolean(data?.user_id);
}

export async function requirePlatformAdmin(): Promise<AppSession> {
  const session = await requireAppSession();

  if (!session.isPlatformAdmin) {
    throw new Error("FORBIDDEN");
  }

  return session;
}

export async function getPlatformAdminSession(): Promise<AppSession | null> {
  const session = await getAppSession();
  if (!session?.isPlatformAdmin) {
    return null;
  }
  return session;
}
