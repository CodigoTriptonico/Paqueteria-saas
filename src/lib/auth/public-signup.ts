/**
 * Public self-service signup is disabled in production by default.
 * Set ALLOW_PUBLIC_SIGNUP=1 in local .env for demo onboarding only.
 */
export function isPublicSignupEnabled(): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  return process.env.ALLOW_PUBLIC_SIGNUP === "1";
}
