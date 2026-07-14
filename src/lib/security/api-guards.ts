import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { readClientIp } from "@/lib/security/request-ip";

export const LOGIN_RATE_LIMIT = {
  bucket: "login",
  windowMs: 15 * 60 * 1000,
  maxAttempts: 8,
} as const;

const VALIDATE_ADDRESS_RATE_LIMIT = {
  bucket: "validate_address",
  windowMs: 60 * 1000,
  maxAttempts: 60,
} as const;

export const VALIDATE_ADDRESS_MAX_BODY_BYTES = 8 * 1024;
export const VALIDATE_ADDRESS_MAX_QUERY_LENGTH = 200;

function loginRateLimitKey(ip: string, email: string) {
  return `ip:${ip}|email:${email.trim().toLowerCase()}`;
}

function validateAddressRateLimitKey(ip: string, userId: string) {
  return `ip:${ip}|user:${userId}`;
}

export async function enforceLoginRateLimit(headers: Headers, email: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return;
  }

  const ip = readClientIp(headers);

  await assertRateLimit(admin, {
    bucket: LOGIN_RATE_LIMIT.bucket,
    key: loginRateLimitKey(ip, email),
    windowMs: LOGIN_RATE_LIMIT.windowMs,
    maxAttempts: LOGIN_RATE_LIMIT.maxAttempts,
  });
}

export async function enforceValidateAddressRateLimit(headers: Headers, userId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return;
  }

  const ip = readClientIp(headers);

  await assertRateLimit(admin, {
    bucket: VALIDATE_ADDRESS_RATE_LIMIT.bucket,
    key: validateAddressRateLimitKey(ip, userId),
    windowMs: VALIDATE_ADDRESS_RATE_LIMIT.windowMs,
    maxAttempts: VALIDATE_ADDRESS_RATE_LIMIT.maxAttempts,
  });
}

export function isRateLimitError(error: unknown) {
  return error instanceof RateLimitError;
}
