"use server";

import { getAppSession } from "@/lib/auth/session";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import type { AppSession } from "@/lib/auth/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function getCurrentSessionAction(): Promise<ActionResult<AppSession | null>> {
  try {
    if (!isSupabaseConfigured()) {
      return ok(null);
    }

    const session = await getAppSession();
    return ok(session);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
