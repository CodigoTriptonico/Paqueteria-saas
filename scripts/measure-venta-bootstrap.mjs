#!/usr/bin/env node
/**
 * Deterministic smoke check for venta bootstrap composition.
 * Run: node scripts/measure-venta-bootstrap.mjs
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["test", "--", "src/lib/sale/bootstrap.test.ts", "src/lib/pricing/sale-derivatives.test.ts"],
  { cwd: root, stdio: "inherit", shell: process.platform === "win32" },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("venta-bootstrap smoke: ok");
