"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACT_AS_ORG_COOKIE, ACT_AS_ORG_COOKIE_MAX_AGE } from "@/lib/auth/act-as";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import { isClientOrganization } from "@/lib/organizations/kind";

async function validateClientOrganization(organizationId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return fail("Supabase no configurado");
  }

  const { data: org, error } = await admin
    .from("organizations")
    .select("id, name, kind, is_active")
    .eq("id", organizationId)
    .maybeSingle();

  if (error || !org) {
    return fail("Cliente no encontrado");
  }

  if (!isClientOrganization(org.kind)) {
    return fail("Solo puedes entrar a paqueterías cliente");
  }

  if (!org.is_active) {
    return fail("Esa paquetería está desactivada");
  }

  return ok(org);
}

export async function enterClientOrganizationAction(
  organizationId: string,
): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    await requirePlatformAdmin();
  } catch (error) {
    return fail(actionErrorMessage(error));
  }

  const validation = await validateClientOrganization(organizationId);
  if (!validation.ok) {
    return validation;
  }

  const cookieStore = await cookies();
  cookieStore.set(ACT_AS_ORG_COOKIE, organizationId, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: ACT_AS_ORG_COOKIE_MAX_AGE,
  });

  return ok({ redirectTo: "/" });
}

export async function exitClientOrganizationAction(): Promise<void> {
  await requirePlatformAdmin();

  const cookieStore = await cookies();
  cookieStore.delete(ACT_AS_ORG_COOKIE);

  redirect("/platform");
}

export async function clearActAsOrganizationCookieAction(): Promise<ActionResult<null>> {
  try {
    await requirePlatformAdmin();
    const cookieStore = await cookies();
    cookieStore.delete(ACT_AS_ORG_COOKIE);
    return ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
