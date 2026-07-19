import type { NextRequest, NextResponse } from "next/server";

export function isSupabaseAuthCookie(name: string) {
  return name.startsWith("sb-");
}

export function clearAuthCookies(response: NextResponse, request: NextRequest) {
  for (const cookie of request.cookies.getAll()) {
    if (isSupabaseAuthCookie(cookie.name)) {
      response.cookies.delete(cookie.name);
    }
  }
}
