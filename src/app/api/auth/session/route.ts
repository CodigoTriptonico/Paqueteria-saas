import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getAppSession();

  if (!session) {
    return NextResponse.json({ ok: false, session: null });
  }

  return NextResponse.json({
    ok: true,
    session: {
      userId: session.userId,
      email: session.email,
      isPlatformAdmin: session.isPlatformAdmin,
      roleSlug: session.roleSlug,
    },
  });
}
