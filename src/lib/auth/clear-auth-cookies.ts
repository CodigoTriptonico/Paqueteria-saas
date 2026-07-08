import type { NextRequest, NextResponse } from "next/server";
import { ACT_AS_ORG_COOKIE } from "@/lib/auth/act-as";

export function clearAuthCookies(response: NextResponse, request: NextRequest) {
  response.cookies.delete(ACT_AS_ORG_COOKIE);

  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-")) {
      response.cookies.delete(cookie.name);
    }
  }
}
