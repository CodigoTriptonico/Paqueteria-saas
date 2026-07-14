import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const SOURCE_EXTENSION_PATTERN = /\.(?:js|jsx|mjs|ts|tsx)$/;
const TEST_FILE_PATTERN = /(?:\.eval)?\.test\./;
const DEBUG_PATTERN = /\b(?:console\.(?:log|debug|trace)\s*\(|debugger\b)/;
const MOJIBAKE_PATTERN = /(?:Ã|Â|â€|\uFFFD)/;

function runtimeSourceFiles(directory) {
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...runtimeSourceFiles(path));
    } else if (SOURCE_EXTENSION_PATTERN.test(entry.name) && !TEST_FILE_PATTERN.test(entry.name)) {
      files.push(path);
    }
  }

  return files;
}

export function sourceTextIssues(root) {
  const issues = [];

  for (const file of runtimeSourceFiles(join(root, "src"))) {
    const source = readFileSync(file, "utf8");
    issues.push(
      ...textIssues(source).map((issue) => ({
        ...issue,
        file: relative(root, file),
      })),
    );
  }

  return issues;
}

export function textIssues(source) {
  const issues = [];

  source.split(/\r?\n/).forEach((line, index) => {
    if (DEBUG_PATTERN.test(line)) {
      issues.push({ type: "debug", line: index + 1 });
    }
    if (MOJIBAKE_PATTERN.test(line)) {
      issues.push({ type: "mojibake", line: index + 1 });
    }
  });

  return issues;
}
