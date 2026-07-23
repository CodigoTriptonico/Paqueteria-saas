import { assertLocalSupabaseUrl, loadEnvLocal } from "./db-connection.mjs";

const LOCAL_CREDENTIAL_FLAG = "ALLOW_LOCAL_CREDENTIAL_SCRIPTS";

export function localCredentialGuardError({
  nodeEnv,
  enabled,
  supabaseUrl,
}) {
  if (nodeEnv !== "development") {
    return "Este script solo puede ejecutarse con NODE_ENV=development.";
  }
  if (enabled !== "1") {
    return `Falta ${LOCAL_CREDENTIAL_FLAG}=1. La ejecución de credenciales locales debe habilitarse explícitamente.`;
  }
  try {
    const parsed = new URL(supabaseUrl);
    if (!["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)) {
      return "Los scripts de credenciales solo aceptan Supabase local.";
    }
  } catch {
    return "NEXT_PUBLIC_SUPABASE_URL local inválida.";
  }
  return null;
}

export function assertLocalCredentialScript() {
  loadEnvLocal();
  assertLocalSupabaseUrl();
  const error = localCredentialGuardError({
    nodeEnv: process.env.NODE_ENV,
    enabled: process.env[LOCAL_CREDENTIAL_FLAG],
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
  if (error) {
    throw new Error(error);
  }

  return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function requireLocalCredential(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Falta ${name} en .env.local.`);
  }
  return value;
}
