"use server";

import { actionErrorMessage, fail, ok } from "@/lib/actions/errors";
import { requireAppSession } from "@/lib/auth/session";
import {
  withoutAgencyModuleData,
  type BusinessWorkspace,
} from "@/lib/business/workspace";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function loadBusinessWorkspaceAction() {
  try {
    const session = await requireAppSession();
    const db = await createSupabaseServerClient();
    if (!db) {
      throw new Error("Supabase no configurado");
    }

    const { data, error } = await db.rpc("load_business_workspace", {
      target_organization_id: session.organizationId,
    });
    if (error) {
      throw new Error(error.message);
    }

    const workspace = data as BusinessWorkspace;
    return ok(
      session.agencyModuleEnabled
        ? workspace
        : withoutAgencyModuleData(workspace),
    );
  } catch (error) {
    return fail<BusinessWorkspace>(actionErrorMessage(error));
  }
}
