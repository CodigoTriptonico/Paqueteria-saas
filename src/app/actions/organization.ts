"use server";

import { requireAppSession } from "@/lib/auth/session";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";

export async function updateOrganizationSettingsAction(settings: {
  multiWarehouseEnabled: boolean;
}): Promise<ActionResult<{ multiWarehouseEnabled: boolean }>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "settings.manage")) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", session.organizationId)
      .single();

    const nextSettings = {
      ...(org?.settings as Record<string, unknown> | undefined),
      multi_warehouse_enabled: settings.multiWarehouseEnabled,
    };

    const { error } = await supabase
      .from("organizations")
      .update({ settings: nextSettings })
      .eq("id", session.organizationId);

    if (error) {
      return fail(error.message);
    }

    return ok({ multiWarehouseEnabled: settings.multiWarehouseEnabled });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
