"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function signInAction(
  email: string,
  password: string,
): Promise<ActionResult<{ userId: string }>> {
  try {
    if (!isSupabaseConfigured()) {
      return fail("Configura Supabase en .env.local");
    }

    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return fail("No se pudo iniciar Supabase");
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      return fail(error?.message || "Credenciales invalidas");
    }

    return ok({ userId: data.user.id });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function signUpAction(
  email: string,
  password: string,
  organizationName: string,
  fullName?: string,
): Promise<ActionResult<{ userId: string }>> {
  try {
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

    const { error: bootstrapError } = await admin.rpc("bootstrap_organization", {
      org_name: organizationName.trim() || "Mi empresa",
      owner_id: signUpData.user.id,
      owner_email: email,
      owner_name: fullName?.trim() || null,
    });

    if (bootstrapError) {
      return fail(bootstrapError.message);
    }

    const ownerEmail = process.env.PLATFORM_OWNER_EMAIL?.trim().toLowerCase();
    if (ownerEmail && ownerEmail === email.trim().toLowerCase()) {
      await admin.rpc("grant_platform_admin", { target_user_id: signUpData.user.id });
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      return fail(signInError.message);
    }

    return ok({ userId: signUpData.user.id });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  redirect("/login");
}
