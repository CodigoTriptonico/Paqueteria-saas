import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppSession } from "@/lib/auth/types";

/** Client data is always read through the authenticated user's own session. */
export async function createScopedSupabase(_session: AppSession) {
  void _session;
  return createSupabaseServerClient();
}
