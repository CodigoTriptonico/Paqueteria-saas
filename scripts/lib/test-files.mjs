import { readdirSync } from "node:fs";
import { join, relative } from "node:path";

const TEST_FILE_PATTERN = /(?:\.eval)?\.test\.(?:ts|tsx|mjs)$/;

function walk(directory) {
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(path));
    } else if (TEST_FILE_PATTERN.test(entry.name)) {
      files.push(path);
    }
  }

  return files;
}

export function testLaneForFile(file) {
  return file.includes(".eval.test.") ? "eval" : "gate";
}

export function discoverTestFiles(root) {
  return ["src", "scripts/lib", "tests/integration"]
    .flatMap((directory) => walk(join(root, directory)))
    .map((file) => relative(root, file).replaceAll("\\", "/"))
    .sort();
}

export function testFilesForLane(root, lane) {
  if (lane !== "gate" && lane !== "eval") {
    throw new Error(`Lane desconocida: ${lane}`);
  }

  return discoverTestFiles(root).filter((file) => testLaneForFile(file) === lane);
}
