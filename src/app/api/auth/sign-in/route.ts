import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/supabase/env";
import { resolvePostLoginRedirect } from "@/lib/organizations/kind";
import {
  APP_SESSION_COOKIE,
  APP_SESSION_COOKIE_MAX_AGE,
  createAppSessionCookieValue,
} from "@/lib/auth/app-session-cookie";

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
    return NextResponse.json({ ok: false, error: "Configura Supabase en .env.local" }, { status: 500 });
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

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", message);
    if (nextPath) {
      loginUrl.searchParams.set("next", nextPath);
    }
    return NextResponse.redirect(loginUrl, 303);
  }

  if (!email || !password) {
    return failLogin("Correo y contrasena requeridos");
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
    return failLogin(error?.message || "Credenciales invalidas", 401);
  }

  const isPlatformAdmin = await loadIsPlatformAdmin(data.user.id);
  const redirectTo = resolvePostLoginRedirect({ isPlatformAdmin, nextPath });
  const appCookie = {
    name: APP_SESSION_COOKIE,
    value: createAppSessionCookieValue(data.user.id),
    options: {
      path: "/",
      sameSite: "lax" as const,
      maxAge: APP_SESSION_COOKIE_MAX_AGE,
    },
  };
  const response = wantsJson
    ? NextResponse.json({ ok: true, redirectTo })
    : NextResponse.redirect(new URL(redirectTo, request.url), 303);

  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  response.cookies.set(appCookie.name, appCookie.value, {
    httpOnly: true,
    ...appCookie.options,
  });

  return response;
}
