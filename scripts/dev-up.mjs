#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import {
  isPortWindowsExcluded,
  loadDevUpConfig,
  waitForHttp,
} from "./lib/dev-up.mjs";

const root = process.cwd();
const openBrowser = !process.argv.includes("--no-open");

function log(step, message) {
  console.log(`[dev:up] ${step}: ${message}`);
}

function fail(message) {
  console.error(`[dev:up] ERROR: ${message}`);
  process.exit(1);
}

function run(command, args, opts = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: opts.inherit ? "inherit" : "pipe",
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    const stderr = result.stderr?.trim() || result.stdout?.trim() || `exit ${result.status}`;
    fail(`${command} ${args.join(" ")} falló: ${stderr}`);
  }
  return result.stdout ?? "";
}

function warnWindowsPortReservations(apiPort, dbPort) {
  if (process.platform !== "win32") return;
  const ranges = run("netsh", ["interface", "ipv4", "show", "excludedportrange", "protocol=tcp"]);
  const blocked = [apiPort, dbPort].filter((port) => isPortWindowsExcluded(port, ranges));
  if (blocked.length === 0) return;
  fail(
    `Windows reservó los puertos ${blocked.join(", ")} (Hyper-V). ` +
      "Cambia puertos en supabase/config.toml, ejecuta npm run env:local y vuelve a intentar.",
  );
}

async function isReachable(url) {
  try {
    const response = await fetch(url, { method: "GET" });
    return response.ok || response.status === 401 || response.status === 404;
  } catch {
    return false;
  }
}

function openApp(url) {
  if (!openBrowser) return;
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  const opener = process.platform === "darwin" ? "open" : "xdg-open";
  spawn(opener, [url], { detached: true, stdio: "ignore" }).unref();
}

async function ensureSupabase(config) {
  if (await isReachable(config.apiHealthUrl)) {
    log("supabase", `ya responde en ${config.apiHealthUrl}`);
    return;
  }

  log("supabase", "no responde; iniciando contenedores (puede tardar ~30s)...");
  run("npm", ["run", "supabase:start"], { inherit: true });
  await waitForHttp(config.apiHealthUrl, { timeoutMs: 120_000, intervalMs: 2_000 });
  log("supabase", "listo");
}

async function ensureEnv(config) {
  if (existsSync(config.envPath) && config.envSynced) {
    log("env", ".env.local coincide con config.toml");
    return;
  }
  log("env", "regenerando .env.local desde template");
  run("npm", ["run", "env:local"], { inherit: true });
}

async function ensureApp(config) {
  if (await isReachable(config.appUrl)) {
    log("next", `ya responde en ${config.appUrl}`);
    openApp(config.appUrl);
    return;
  }

  log("next", "iniciando npm run dev");
  openApp(config.appUrl);
  const child = spawn("npm", ["run", "dev"], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  child.on("exit", (code) => process.exit(code ?? 1));
}

async function main() {
  log("docker", "comprobando motor");
  run("docker", ["info"], { inherit: false });

  const config = loadDevUpConfig(root);
  warnWindowsPortReservations(config.ports.apiPort, config.ports.dbPort);
  await ensureEnv(loadDevUpConfig(root));
  await ensureSupabase(loadDevUpConfig(root));
  await ensureApp(loadDevUpConfig(root));
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
