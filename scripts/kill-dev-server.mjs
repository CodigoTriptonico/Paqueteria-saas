#!/usr/bin/env node
import { listNodeProcesses, killDevServer, isProjectDevProcess } from "./lib/dev-server.mjs";

const root = process.cwd();

function countProjectNodes() {
  return listNodeProcesses().filter((proc) => isProjectDevProcess(root, proc.commandLine)).length;
}

const before = countProjectNodes();
const killed = killDevServer(root);

console.log(`[dev:kill] procesos del proyecto antes: ${before}`);
console.log(`[dev:kill] PIDs terminados: ${killed.length ? killed.join(", ") : "(ninguno)"}`);

if (process.platform === "win32") {
  await new Promise((resolve) => setTimeout(resolve, 1500));
}

const after = countProjectNodes();
console.log(`[dev:kill] procesos del proyecto despues: ${after}`);

if (after > 5) {
  console.warn(
    "[dev:kill] AVISO: siguen quedando procesos node del proyecto. " +
      "Cierra ventanas con npm run dev y vuelve a ejecutar npm run dev:kill.",
  );
  process.exit(1);
}
