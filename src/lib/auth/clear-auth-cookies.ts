import type { NextRequest, NextResponse } from "next/server";
import { ACT_AS_ORG_COOKIE } from "@/lib/auth/act-as";
import { APP_SESSION_COOKIE } from "@/lib/auth/app-session-cookie";

export function clearAuthCookies(response: NextResponse, request: NextRequest) {
  response.cookies.delete(APP_SESSION_COOKIE);
  response.cookies.delete(ACT_AS_ORG_COOKIE);

  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-")) {
      response.cookies.delete(cookie.name);
    }
  }
}
