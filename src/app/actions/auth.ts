"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import { APP_SESSION_COOKIE, APP_SESSION_COOKIE_MAX_AGE, createAppSessionCookieValue } from "@/lib/auth/app-session-cookie";
import { isPlatformOwnerEmail, platformOwnerOrganizationName } from "@/lib/auth/platform-owner";
import { resolvePostLoginRedirect } from "@/lib/organizations/kind";
import { PHONE_RECOVERY_ENABLED } from "@/lib/phone/features";
import { isValidNationalPhone } from "@/lib/phone/countries";
import { normalizePhoneE164 } from "@/lib/phone/normalize";
import {
  ensureAuthPhoneForOtp,
  findActiveProfileByPhone,
  restoreAuthPrimaryPhone,
} from "@/lib/phone/profile-phones";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const PHONE_RECOVERY_DISABLED_MESSAGE =
  "Recuperación por celular estará disponible pronto. Por ahora contacta al administrador de tu paquetería.";

async function loadIsPlatformAdmin(userId: string) {
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

export async function signInAction(
  email: string,
  password: string,
  nextPath?: string | null,
): Promise<ActionResult<{ redirectTo: string }>> {
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

  const isPlatformAdmin = await loadIsPlatformAdmin(data.user.id);
  return ok({ redirectTo: resolvePostLoginRedirect({ isPlatformAdmin, nextPath }) });
}

export async function signUpAction(
  email: string,
  password: string,
  organizationName: string,
  fullName?: string,
  nextPath?: string | null,
): Promise<ActionResult<{ redirectTo: string }>> {
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

  const ownerSignup = isPlatformOwnerEmail(email);
  const orgName = ownerSignup
    ? platformOwnerOrganizationName()
    : organizationName.trim() || "Mi empresa";
  const orgKind = ownerSignup ? "platform" : "client";

  const { error: bootstrapError } = await admin.rpc("bootstrap_organization", {
    org_name: orgName,
    owner_id: signUpData.user.id,
    owner_email: email,
    owner_name: fullName?.trim() || null,
    org_kind: orgKind,
  });

  if (bootstrapError) {
    return fail(bootstrapError.message);
  }

  let isPlatformAdmin = false;
  if (ownerSignup) {
    await admin.rpc("grant_platform_admin", { target_user_id: signUpData.user.id });
    isPlatformAdmin = true;
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  if (signInError) {
    return fail(signInError.message);
  }

  const cookieStore = await cookies();
  cookieStore.set(APP_SESSION_COOKIE, createAppSessionCookieValue(signUpData.user.id), {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: APP_SESSION_COOKIE_MAX_AGE,
  });

  return ok({ redirectTo: resolvePostLoginRedirect({ isPlatformAdmin, nextPath }) });
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  const cookieStore = await cookies();
  cookieStore.delete(APP_SESSION_COOKIE);
  redirect("/login");
}

export async function sendPasswordResetOtpAction(phone: string): Promise<ActionResult<null>> {
  try {
    if (!PHONE_RECOVERY_ENABLED) {
      return fail(PHONE_RECOVERY_DISABLED_MESSAGE);
    }

    if (!isSupabaseConfigured()) {
      return fail("Configura Supabase en .env.local");
    }

    const e164 = normalizePhoneE164(phone);
    if (!e164 || !isValidNationalPhone(phone)) {
      return fail("Ingresa un número de celular válido.");
    }

    const admin = createSupabaseAdminClient();
    if (!admin) {
      return fail("Supabase no configurado");
    }

    const profile = await findActiveProfileByPhone(admin, phone);
    if (!profile) {
      return fail("No encontramos una cuenta activa con ese número.");
    }

    try {
      await ensureAuthPhoneForOtp(admin, profile.id, e164);
    } catch (syncError) {
      return fail(actionErrorMessage(syncError));
    }

    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return fail("No se pudo iniciar Supabase");
    }

    const { error } = await supabase.auth.signInWithOtp({
      phone: e164,
      options: { shouldCreateUser: false },
    });

    if (error) {
      try {
        await restoreAuthPrimaryPhone(admin, profile.id);
      } catch {
        // ignore restore errors after failed OTP
      }

      const message = error.message.toLowerCase().includes("phone")
        ? "El envío de SMS no está configurado. Revisa Phone Auth en Supabase (Twilio)."
        : error.message;
      return fail(message);
    }

    return ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function resetPasswordWithPhoneOtpAction(
  phone: string,
  token: string,
  newPassword: string,
): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    if (!PHONE_RECOVERY_ENABLED) {
      return fail(PHONE_RECOVERY_DISABLED_MESSAGE);
    }

    if (!isSupabaseConfigured()) {
      return fail("Configura Supabase en .env.local");
    }

    const e164 = normalizePhoneE164(phone);
    const code = token.trim();

    if (!e164 || !isValidNationalPhone(phone)) {
      return fail("Número de celular inválido.");
    }

    if (code.length < 6) {
      return fail("Ingresa el código de 6 dígitos.");
    }

    if (newPassword.length < 8) {
      return fail("La nueva contraseña debe tener al menos 8 caracteres.");
    }

    const admin = createSupabaseAdminClient();
    if (!admin) {
      return fail("Supabase no configurado");
    }

    const profile = await findActiveProfileByPhone(admin, phone);
    if (!profile) {
      return fail("No encontramos una cuenta activa con ese número.");
    }

    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return fail("No se pudo iniciar Supabase");
    }

    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone: e164,
      token: code,
      type: "sms",
    });

    if (verifyError) {
      return fail(verifyError.message || "Código incorrecto o vencido.");
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      return fail(updateError.message);
    }

    try {
      await restoreAuthPrimaryPhone(admin, profile.id);
    } catch (restoreError) {
      return fail(actionErrorMessage(restoreError));
    }

    return ok({ redirectTo: "/" });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
