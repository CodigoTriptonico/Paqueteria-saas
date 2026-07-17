import type { NextRequest, NextResponse } from "next/server";

export function clearAuthCookies(response: NextResponse, request: NextRequest) {

  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-")) {
      response.cookies.delete(cookie.name);
    }
  }
}
