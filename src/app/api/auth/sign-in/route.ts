import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/supabase/env";
import { resolveRequestUrl } from "@/lib/http/request-origin";
import { resolvePostLoginRedirect } from "@/lib/organizations/kind";
import {
  enforceLoginRateLimit,
  isRateLimitError,
  LOGIN_RATE_LIMIT,
} from "@/lib/security/api-guards";

const GENERIC_LOGIN_ERROR = "Credenciales invalidas";

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

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Servicio no disponible" }, { status: 500 });
  }

  const contentType = request.headers.get("content-type") || "";
  const wantsJson = contentType.includes("application/json");
  const body = wantsJson
    ? ((await request.json().catch(() => null)) as {
        email?: string;
        password?: string;
        nextPath?: string | null;
      } | null)
    : null;
  const form = wantsJson ? null : await request.formData();

  const email = wantsJson
    ? body?.email?.trim() || ""
    : String(form?.get("email") || "").trim();
  const password = wantsJson
    ? body?.password || ""
    : String(form?.get("password") || "");
  const nextPath = wantsJson
    ? body?.nextPath || null
    : String(form?.get("nextPath") || "") || null;

  function failLogin(message: string, status = 400) {
    if (wantsJson) {
      return NextResponse.json({ ok: false, error: message }, { status });
    }

    const loginUrl = resolveRequestUrl(request, "/login");
    loginUrl.searchParams.set("error", message);
    if (nextPath) {
      loginUrl.searchParams.set("next", nextPath);
    }
    return NextResponse.redirect(loginUrl, 303);
  }

  if (!email || !password) {
    return failLogin("Correo y contrasena requeridos");
  }

  try {
    await enforceLoginRateLimit(request.headers, email);
  } catch (error) {
    if (isRateLimitError(error)) {
      return failLogin(error.message, 429);
    }
    console.error("[auth/sign-in] rate limit error", error);
    return failLogin("Servicio temporalmente no disponible", 503);
  }

  const cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[] = [];
  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(nextCookies: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.push(...nextCookies);
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    if (error) {
      console.error("[auth/sign-in] supabase login failed", {
        code: error.code,
        message: error.message,
        bucket: LOGIN_RATE_LIMIT.bucket,
      });
    }
    return failLogin(GENERIC_LOGIN_ERROR, 401);
  }

  const isPlatformAdmin = await loadIsPlatformAdmin(data.user.id);
  const redirectTo = resolvePostLoginRedirect({ isPlatformAdmin, nextPath });
  const response = wantsJson
    ? NextResponse.json({ ok: true, redirectTo })
    : NextResponse.redirect(resolveRequestUrl(request, redirectTo), 303);

  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });

  return response;
}
