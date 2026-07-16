/**
 * Reinicia la operación y vuelve a asegurar la semilla base del catálogo.
 * No borra usuarios, remitentes, destinatarios, países, ítems ni precios.
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const scripts = [
  "reset-operational-data-keep-catalog.mjs",
  "seed-scgs-demo-catalog.mjs",
];

for (const script of scripts) {
  const result = spawnSync(process.execPath, [join(root, "scripts", script)], {
    cwd: root,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("Listo: aplicación reiniciada con la semilla base.");
