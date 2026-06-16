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

export function isLocalDatabaseMode() {
  loadEnvLocal();

  const mode = process.env.DATABASE_MODE?.trim().toLowerCase();
  if (mode === "local") {
    return true;
  }
  if (mode === "remote") {
    return false;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return (
    supabaseUrl.includes("127.0.0.1") ||
    supabaseUrl.includes("localhost") ||
    supabaseUrl.startsWith("http://")
  );
}

function projectRefFromUrl(url) {
  const match = url.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/i);
  return match?.[1] ?? null;
}

export function resolvePgConnectionConfig() {
  loadEnvLocal();

  const explicitUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (explicitUrl) {
    return {
      connectionString: explicitUrl,
      ssl: explicitUrl.includes("supabase.co"),
      label: "custom database URL",
      mode: isLocalDatabaseMode() ? "local" : "remote",
    };
  }

  if (isLocalDatabaseMode()) {
    const host = process.env.SUPABASE_DB_HOST || "127.0.0.1";
    const port = process.env.SUPABASE_DB_PORT || "54322";
    const password = process.env.SUPABASE_DB_PASSWORD || "postgres";

    return {
      connectionString: `postgresql://postgres:${encodeURIComponent(password)}@${host}:${port}/postgres`,
      ssl: false,
      label: `local postgres @ ${host}:${port}`,
      mode: "local",
    };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const dbPassword = process.env.SUPABASE_DB_PASSWORD;

  if (!supabaseUrl || supabaseUrl.includes("your-project")) {
    throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL en .env.local");
  }

  if (!dbPassword) {
    throw new Error("Falta SUPABASE_DB_PASSWORD en .env.local");
  }

  const ref = projectRefFromUrl(supabaseUrl);
  if (!ref) {
    throw new Error(`URL de Supabase remota no válida: ${supabaseUrl}`);
  }

  return {
    connectionString: `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${ref}.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false },
    label: `supabase cloud (${ref})`,
    mode: "remote",
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
