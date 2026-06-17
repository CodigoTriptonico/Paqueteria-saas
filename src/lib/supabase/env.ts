function supabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
}

function assertLocalOnly() {
  const url = supabaseUrl();
  if (url.includes("supabase.co")) {
    throw new Error(
      "Boxario solo corre con Supabase local. Ejecuta npm run env:local y npm run supabase:start.",
    );
  }
}

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Supabase CLI en Docker (127.0.0.1). */
export function isLocalSupabase() {
  if (!isSupabaseConfigured()) {
    return false;
  }

  const url = supabaseUrl();
  return url.includes("127.0.0.1") || url.includes("localhost");
}

export function getSupabaseUrl() {
  const url = supabaseUrl();
  if (!url) {
    throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL");
  }

  assertLocalOnly();
  return url;
}

export function getSupabaseAnonKey() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error("Falta NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return key;
}

export function getSupabaseServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY");
  }
  return key;
}
