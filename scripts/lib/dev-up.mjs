import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/** @param {string} toml */
export function parseSupabasePortsFromConfig(toml) {
  const api = toml.match(/^\[api\][\s\S]*?^port\s*=\s*(\d+)/m)?.[1];
  const db = toml.match(/^\[db\][\s\S]*?^port\s*=\s*(\d+)/m)?.[1];
  if (!api || !db) {
    throw new Error("No se pudieron leer puertos API/DB en supabase/config.toml");
  }
  return { apiPort: Number(api), dbPort: Number(db) };
}

/** @param {string} envText */
export function parseEnvSupabaseUrl(envText) {
  const line = envText
    .split(/\r?\n/)
    .find((row) => row.startsWith("NEXT_PUBLIC_SUPABASE_URL="));
  if (!line) return null;
  return line.slice("NEXT_PUBLIC_SUPABASE_URL=".length).trim();
}

/** @param {string | null | undefined} envUrl @param {number} apiPort */
export function envUrlMatchesApiPort(envUrl, apiPort) {
  if (!envUrl) return false;
  try {
    const url = new URL(envUrl);
    return url.port === String(apiPort) || (apiPort === 80 && url.port === "");
  } catch {
    return false;
  }
}

/** @param {number} port @param {string} rangesText */
export function isPortWindowsExcluded(port, rangesText) {
  for (const match of rangesText.matchAll(/(\d+)\s+(\d+)/g)) {
    const start = Number(match[1]);
    const end = Number(match[2]);
    if (port >= start && port <= end) return true;
  }
  return false;
}

/** @param {string} url @param {{ timeoutMs?: number, intervalMs?: number }} [opts] */
export async function waitForHttp(url, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const intervalMs = opts.intervalMs ?? 1_000;
  const deadline = Date.now() + timeoutMs;
  let lastError = "sin respuesta";

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.ok || response.status === 401 || response.status === 404) {
        return true;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timeout esperando ${url}: ${lastError}`);
}

/** @param {string} root */
export function loadDevUpConfig(root) {
  const configPath = join(root, "supabase", "config.toml");
  const envPath = join(root, ".env.local");
  const ports = parseSupabasePortsFromConfig(readFileSync(configPath, "utf8"));
  const envText = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const envUrl = parseEnvSupabaseUrl(envText);
  return {
    ports,
    envPath,
    envUrl,
    envSynced: envUrlMatchesApiPort(envUrl, ports.apiPort),
    apiHealthUrl: `http://127.0.0.1:${ports.apiPort}/rest/v1/`,
    appUrl: "http://localhost:3000",
  };
}
