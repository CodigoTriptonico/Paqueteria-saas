import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ACT_AS_ORG_COOKIE } from "@/lib/auth/act-as";
import { APP_SESSION_COOKIE, readAppSessionCookieValue } from "@/lib/auth/app-session-cookie";

const PUBLIC_PATHS = ["/login", "/api/auth/sign-in"];

function copyCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie.name, cookie.value);
  });
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
    return NextResponse.next();
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

  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  const fallbackUserId = readAppSessionCookieValue(request.cookies.get(APP_SESSION_COOKIE)?.value);

  if (!user && !fallbackUserId) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    copyCookies(supabaseResponse, redirectResponse);
    return redirectResponse;
  }

  if (pathname.startsWith("/platform")) {
    supabaseResponse.cookies.delete(ACT_AS_ORG_COOKIE);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
