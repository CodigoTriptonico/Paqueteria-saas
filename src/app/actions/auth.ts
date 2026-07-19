"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fail, ok, type ActionResult } from "@/lib/actions/errors";
import { isSupabaseAuthCookie } from "@/lib/auth/clear-auth-cookies";
import { isPublicSignupEnabled } from "@/lib/auth/public-signup";
import { resolvePostLoginRedirect } from "@/lib/organizations/kind";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { deleteAuthUserSafely } from "@/lib/security/auth-cleanup";
import { normalizePersonName } from "@/lib/person-name";




export async function signUpAction(
  email: string,
  password: string,
  organizationName: string,
  fullName?: string,
  nextPath?: string | null,
): Promise<ActionResult<{ redirectTo: string }>> {
  if (!isPublicSignupEnabled()) {
    return fail("El registro publico no esta disponible. Contacta al administrador.");
  }

  if (!isSupabaseConfigured()) {
    return fail("Configura Supabase en .env.local");
  }

  const admin = createSupabaseAdminClient();
  const supabase = await createSupabaseServerClient();

  if (!admin || !supabase) {
    return fail("No se pudo iniciar Supabase");
  }

  const { data: signUpData, error: signUpError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (signUpError || !signUpData.user) {
    return fail(signUpError?.message || "No se pudo crear el usuario");
  }

  const orgName = organizationName.trim() || "Mi empresa";

  const { error: bootstrapError } = await admin.rpc("bootstrap_organization", {
    org_name: orgName,
    owner_id: signUpData.user.id,
    owner_email: email,
    owner_name: fullName ? normalizePersonName(fullName) || null : null,
    org_kind: "client",
  });

  if (bootstrapError) {
    await deleteAuthUserSafely(admin, signUpData.user.id);
    return fail(bootstrapError.message);
  }

  const isPlatformAdmin = false;

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  if (signInError) {
    return fail(signInError.message);
  }

  return ok({ redirectTo: resolvePostLoginRedirect({ isPlatformAdmin, nextPath }) });
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }

  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    if (isSupabaseAuthCookie(cookie.name)) {
      cookieStore.delete(cookie.name);
    }
  }

  redirect("/login");
}
