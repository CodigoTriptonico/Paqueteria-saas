import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { readClientIp } from "@/lib/security/request-ip";

export const LOGIN_RATE_LIMIT = {
  bucket: "login",
  windowMs: 15 * 60 * 1000,
  maxAttempts: 8,
} as const;

const PUBLIC_TRACKING_RATE_LIMIT = {
  bucket: "public_tracking",
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

function publicTrackingRateLimitKey(ip: string, code: string) {
  return `ip:${ip}|code:${code}`;
}

export async function enforceLoginRateLimit(headers: Headers, email: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error("RATE_LIMIT_UNAVAILABLE");
  }

  const ip = readClientIp(headers);
  const account = email.trim().toLowerCase();
  await Promise.all([
    assertRateLimit(admin, {
      bucket: LOGIN_RATE_LIMIT.bucket,
      key: loginRateLimitKey(ip, account),
      windowMs: LOGIN_RATE_LIMIT.windowMs,
      maxAttempts: LOGIN_RATE_LIMIT.maxAttempts,
    }),
    assertRateLimit(admin, {
      bucket: `${LOGIN_RATE_LIMIT.bucket}_ip`,
      key: `ip:${ip}`,
      windowMs: LOGIN_RATE_LIMIT.windowMs,
      maxAttempts: 30,
    }),
    assertRateLimit(admin, {
      bucket: `${LOGIN_RATE_LIMIT.bucket}_account`,
      key: `account:${account}`,
      windowMs: LOGIN_RATE_LIMIT.windowMs,
      maxAttempts: 12,
    }),
  ]);
}

export async function enforceValidateAddressRateLimit(headers: Headers, userId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error("RATE_LIMIT_UNAVAILABLE");
  }

  const ip = readClientIp(headers);

  await assertRateLimit(admin, {
    bucket: VALIDATE_ADDRESS_RATE_LIMIT.bucket,
    key: validateAddressRateLimitKey(ip, userId),
    windowMs: VALIDATE_ADDRESS_RATE_LIMIT.windowMs,
    maxAttempts: VALIDATE_ADDRESS_RATE_LIMIT.maxAttempts,
  });
}

export async function enforcePublicTrackingRateLimit(headers: Headers, code: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("RATE_LIMIT_UNAVAILABLE");
  const ip = readClientIp(headers);
  await Promise.all([
    assertRateLimit(admin, {
      bucket: PUBLIC_TRACKING_RATE_LIMIT.bucket,
      key: publicTrackingRateLimitKey(ip, code),
      windowMs: PUBLIC_TRACKING_RATE_LIMIT.windowMs,
      maxAttempts: PUBLIC_TRACKING_RATE_LIMIT.maxAttempts,
    }),
    assertRateLimit(admin, {
      bucket: `${PUBLIC_TRACKING_RATE_LIMIT.bucket}_ip`,
      key: `ip:${ip}`,
      windowMs: PUBLIC_TRACKING_RATE_LIMIT.windowMs,
      maxAttempts: 24,
    }),
    assertRateLimit(admin, {
      bucket: `${PUBLIC_TRACKING_RATE_LIMIT.bucket}_code`,
      key: `code:${code}`,
      windowMs: PUBLIC_TRACKING_RATE_LIMIT.windowMs,
      maxAttempts: 12,
    }),
  ]);
}

export function isRateLimitError(error: unknown) {
  return error instanceof RateLimitError;
}
