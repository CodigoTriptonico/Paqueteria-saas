import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ACT_AS_ORG_COOKIE } from "@/lib/auth/act-as";
import { clearAuthCookies } from "@/lib/auth/clear-auth-cookies";
import { resolveAuthUser } from "@/lib/auth/resolve-auth-user";

const PUBLIC_PATHS = ["/login", "/rastrear", "/api/auth/sign-in", "/api/public/tracking"];

function redirectToLogin(
  request: NextRequest,
  options?: { error?: string; nextPath?: string },
) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.delete("error");
  loginUrl.searchParams.delete("next");

  if (options?.error) {
    loginUrl.searchParams.set("error", options.error);
  }

  if (options?.nextPath) {
    loginUrl.searchParams.set("next", options.nextPath);
  }

  const redirectResponse = NextResponse.redirect(loginUrl);
  clearAuthCookies(redirectResponse, request);
  return redirectResponse;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp)$/)
  ) {
    return NextResponse.next();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    if (pathname.startsWith("/login")) {
      return NextResponse.next();
    }

    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { ok: false, error: "Servicio no configurado" },
        { status: 503 },
      );
    }

    return redirectToLogin(request, { error: "Servicio no configurado" });
  }

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (isPublic) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/platform")) {
    request.cookies.delete(ACT_AS_ORG_COOKIE);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-boxario-pathname", pathname);

  const forwardedRequest = { headers: requestHeaders };

  let supabaseResponse = NextResponse.next({
    request: forwardedRequest,
  });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({
          request: forwardedRequest,
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const auth = await resolveAuthUser(() => supabase.auth.getUser());

  if (auth.status === "unavailable") {
    if (pathname.startsWith("/api/")) {
      const response = NextResponse.json(
        { ok: false, error: "Servicio no disponible. Intenta de nuevo." },
        { status: 503 },
      );
      clearAuthCookies(response, request);
      return response;
    }

    return redirectToLogin(request, {
      error: "No se pudo conectar con el servidor. Inicia sesion cuando este disponible.",
      nextPath: pathname,
    });
  }

  if (auth.status === "unauthenticated") {
    if (pathname.startsWith("/api/")) {
      const response = NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
      clearAuthCookies(response, request);
      return response;
    }

    return redirectToLogin(request, { nextPath: pathname });
  }

  if (pathname.startsWith("/platform")) {
    supabaseResponse.cookies.delete(ACT_AS_ORG_COOKIE);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
