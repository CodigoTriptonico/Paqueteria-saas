import { execSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DEV_PORT = 3000;
const PID_FILE = ".dev-server.pid";

/** @param {number} port */
export function getListenerPidsOnPort(port) {
  if (process.platform === "win32") {
    const out = execSync("netstat -ano", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const pids = new Set();
    const portToken = `:${port}`;
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes("LISTENING")) continue;
      if (!line.includes(portToken)) continue;
      const parts = line.trim().split(/\s+/);
      const pid = Number(parts.at(-1));
      if (Number.isInteger(pid) && pid > 0) pids.add(pid);
    }
    return [...pids];
  }

  const result = spawnSync("lsof", ["-ti", `tcp:${port}`], { encoding: "utf8" });
  if (result.status !== 0) return [];
  return result.stdout
    .split(/\s+/)
    .map((value) => Number(value))
    .filter((pid) => Number.isInteger(pid) && pid > 0);
}

/** @returns {{ pid: number, commandLine: string }[]} */
export function listNodeProcesses() {
  if (process.platform === "win32") {
    const result = spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        "Get-CimInstance Win32_Process -Filter \"name = 'node.exe'\" | Select-Object ProcessId, CommandLine | ConvertTo-Json -Compress",
      ],
      { encoding: "utf8" },
    );
    if (result.status !== 0) return [];
    const out = result.stdout.trim();
    if (!out) return [];
    const parsed = JSON.parse(out);
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    return rows
      .map((row) => ({
        pid: Number(row.ProcessId),
        commandLine: String(row.CommandLine ?? ""),
      }))
      .filter((row) => Number.isInteger(row.pid) && row.pid > 0);
  }

  const result = spawnSync("ps", ["-axo", "pid=,command="], { encoding: "utf8" });
  if (result.status !== 0) return [];
  return result.stdout
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/^\s*(\d+)\s+(.*)$/);
      if (!match) return null;
      const commandLine = match[2];
      if (!/\bnode\b/.test(commandLine)) return null;
      return { pid: Number(match[1]), commandLine };
    })
    .filter((row) => row && Number.isInteger(row.pid));
}

/** @param {string} root @param {string} commandLine */
export function isProjectDevProcess(root, commandLine) {
  if (!commandLine) return false;
  const normalizedRoot = root.replace(/\\/g, "/").toLowerCase();
  const normalizedCmd = commandLine.replace(/\\/g, "/").toLowerCase();
  if (!normalizedCmd.includes(normalizedRoot)) return false;
  return (
    normalizedCmd.includes("next/dist/bin/next") ||
    normalizedCmd.includes("next/dist/server/lib/start-server") ||
    normalizedCmd.includes("/next dev") ||
    normalizedCmd.includes(" next dev") ||
    /npm(\.cmd)?\s+run\s+dev\b/.test(normalizedCmd)
  );
}

/** @param {string} root */
export function collectDevServerPids(root) {
  const pids = new Set(getListenerPidsOnPort(DEV_PORT));
  for (const proc of listNodeProcesses()) {
    if (isProjectDevProcess(root, proc.commandLine)) {
      pids.add(proc.pid);
    }
  }

  const pidFile = join(root, PID_FILE);
  if (existsSync(pidFile)) {
    const recorded = Number(readFileSync(pidFile, "utf8").trim());
    if (Number.isInteger(recorded) && recorded > 0) pids.add(recorded);
  }

  return [...pids];
}

/** @param {number} pid */
function killPid(pid) {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/F", "/T", "/PID", String(pid)], { stdio: "ignore" });
    return;
  }
  spawnSync("kill", ["-9", String(pid)], { stdio: "ignore" });
}

/** @param {string} root */
export function killDevServer(root) {
  const targets = collectDevServerPids(root);
  for (const pid of targets) {
    killPid(pid);
  }

  const pidFile = join(root, PID_FILE);
  if (existsSync(pidFile)) {
    unlinkSync(pidFile);
  }

  return targets;
}

/** @param {string} root @param {number} pid */
export function writeDevServerPid(root, pid) {
  writeFileSync(join(root, PID_FILE), `${pid}\n`, "utf8");
}

export function devServerPort() {
  return DEV_PORT;
}
