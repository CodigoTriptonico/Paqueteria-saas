import type { AuthError, User } from "@supabase/supabase-js";

export type AuthUserResolution =
  | { status: "authenticated"; user: User }
  | { status: "unauthenticated" }
  | { status: "unavailable" };

export function isAuthServiceUnavailable(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const message =
    "message" in error && typeof error.message === "string" ? error.message.toLowerCase() : "";

  if (
    message.includes("fetch failed") ||
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("etimedout")
  ) {
    return true;
  }

  const cause = "cause" in error ? error.cause : null;
  if (cause && typeof cause === "object") {
    const code = "code" in cause && typeof cause.code === "string" ? cause.code : "";
    if (
      code === "ECONNREFUSED" ||
      code === "ENOTFOUND" ||
      code === "ETIMEDOUT" ||
      code === "ECONNRESET"
    ) {
      return true;
    }
  }

  return false;
}

export async function resolveAuthUser(
  getUser: () => Promise<{ data: { user: User | null }; error: AuthError | null }>,
): Promise<AuthUserResolution> {
  try {
    const { data, error } = await getUser();

    if (error) {
      if (isAuthServiceUnavailable(error)) {
        return { status: "unavailable" };
      }

      return { status: "unauthenticated" };
    }

    if (!data.user) {
      return { status: "unauthenticated" };
    }

    return { status: "authenticated", user: data.user };
  } catch (error) {
    if (isAuthServiceUnavailable(error)) {
      return { status: "unavailable" };
    }

    return { status: "unauthenticated" };
  }
}
