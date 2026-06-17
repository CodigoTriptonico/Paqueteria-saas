import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.join(__dirname, "..", "..");

export function loadEnvLocal(root = projectRoot) {
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) {
    return;
  }

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }

    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

export function assertLocalSupabaseUrl(url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "") {
  if (!url) {
    throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL en .env.local");
  }

  if (url.includes("supabase.co")) {
    throw new Error(
      "Este proyecto solo usa Supabase local. Ejecuta: npm run env:local (y npm run supabase:start).",
    );
  }

  if (
    !url.includes("127.0.0.1") &&
    !url.includes("localhost")
  ) {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL debe apuntar a Supabase local (127.0.0.1:54321). Valor actual: ${url}`,
    );
  }
}

export function isLocalDatabaseMode() {
  loadEnvLocal();
  return true;
}

export function isLocalSupabase() {
  loadEnvLocal();
  assertLocalSupabaseUrl();
  return true;
}

export function resolvePgConnectionConfig() {
  loadEnvLocal();
  assertLocalSupabaseUrl();

  const explicitUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (explicitUrl) {
    if (explicitUrl.includes("supabase.co")) {
      throw new Error("SUPABASE_DB_URL remota no permitida. Usa Supabase local.");
    }

    return {
      connectionString: explicitUrl,
      ssl: false,
      label: "custom local database URL",
      mode: "local",
    };
  }

  const host = process.env.SUPABASE_DB_HOST || "127.0.0.1";
  const port = process.env.SUPABASE_DB_PORT || "55322";
  const password = process.env.SUPABASE_DB_PASSWORD || "postgres";

  return {
    connectionString: `postgresql://postgres:${encodeURIComponent(password)}@${host}:${port}/postgres`,
    ssl: false,
    label: `local postgres @ ${host}:${port}`,
    mode: "local",
  };
}

export async function connectPg() {
  const config = resolvePgConnectionConfig();
  const client = new pg.Client({
    connectionString: config.connectionString,
    ssl: config.ssl,
  });

  await client.connect();
  return { client, ...config };
}
