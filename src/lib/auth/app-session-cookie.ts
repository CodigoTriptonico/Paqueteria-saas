import { createHmac, timingSafeEqual } from "node:crypto";
import { getSupabaseServiceRoleKey } from "@/lib/supabase/env";

export const APP_SESSION_COOKIE = "boxario_app_session";
export const APP_SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

function signUserId(userId: string) {
  return createHmac("sha256", getSupabaseServiceRoleKey()).update(userId).digest("base64url");
}

export function createAppSessionCookieValue(userId: string) {
  return `${userId}.${signUserId(userId)}`;
}

export function readAppSessionCookieValue(value: string | undefined | null) {
  if (!value) {
    return null;
  }

  const splitAt = value.lastIndexOf(".");
  if (splitAt <= 0) {
    return null;
  }

  const userId = value.slice(0, splitAt);
  const signature = value.slice(splitAt + 1);
  const expected = signUserId(userId);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }

  return userId;
}
