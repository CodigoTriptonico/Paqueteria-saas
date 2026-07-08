import type { SupabaseClient } from "@supabase/supabase-js";

export async function deleteAuthUserSafely(
  admin: SupabaseClient | null | undefined,
  userId: string | null | undefined,
) {
  if (!admin || !userId) {
    return;
  }

  try {
    await admin.auth.admin.deleteUser(userId);
  } catch {
    // Best-effort rollback; original error should still propagate.
  }
}
