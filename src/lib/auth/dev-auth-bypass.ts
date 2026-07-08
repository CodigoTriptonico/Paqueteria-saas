export function isDevAuthBypassEnabled() {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  if (process.env.DEV_AUTH_BYPASS !== "1") {
    return false;
  }

  // Extra guard: never bypass unless explicitly local Supabase or localhost app URL.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || "";

  const localSupabase =
    supabaseUrl.includes("127.0.0.1") ||
    supabaseUrl.includes("localhost") ||
    supabaseUrl === "";

  const localApp =
    !appUrl ||
    appUrl.includes("localhost") ||
    appUrl.includes("127.0.0.1") ||
    appUrl.startsWith("192.168.");

  return localSupabase && localApp;
}
