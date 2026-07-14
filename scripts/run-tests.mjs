#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { testFilesForLane } from "./lib/test-files.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const lane = process.argv[2];
if (lane !== "gate" && lane !== "eval") {
  console.error("Uso: node scripts/run-tests.mjs <gate|eval>");
  process.exit(2);
}
const files = testFilesForLane(root, lane);

function run(label, args, fileCount) {
  if (fileCount === 0) {
    return;
  }

  console.log(`[test:${lane}] ${label}: ${fileCount} archivos`);
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(
  "Archivos",
  [join(root, "node_modules", "tsx", "dist", "cli.mjs"), "--test", ...files],
  files.length,
);
