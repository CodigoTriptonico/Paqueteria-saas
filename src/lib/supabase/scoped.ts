import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppSession } from "@/lib/auth/types";

/** Usa service role cuando el dueño opera dentro de una paquetería cliente. */
export async function createScopedSupabase(session: AppSession) {
  if (session.isActingAsClient) {
    const admin = createSupabaseAdminClient();
    if (!admin) {
      return null;
    }
    return admin;
  }

  return createSupabaseServerClient();
}
