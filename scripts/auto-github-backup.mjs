#!/usr/bin/env node
import {
  appendFileSync,
  closeSync,
  mkdirSync,
  openSync,
  rmSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  automaticBackupCommitMessage,
  isExcludedFromBackup,
} from "./lib/git-backup.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run");
const logDirectory = join(process.env.LOCALAPPDATA ?? root, "PaqueteriaSaas");
const logFile = join(logDirectory, "github-backup.log");
const lockFile = join(root, ".git", "auto-github-backup.lock");
let lockHandle;

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  mkdirSync(logDirectory, { recursive: true });
  appendFileSync(logFile, `${line}\n`, "utf8");
}

function git(args, { allowFailure = false, printOutput = true } = {}) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
  });

  if (printOutput && result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (printOutput && result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.error) {
    throw result.error;
  }
  if (!allowFailure && result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed with exit code ${result.status}`);
  }

  return result;
}

function stagedPaths() {
  return git(["diff", "--cached", "--name-only", "-z"], { printOutput: false })
    .stdout.split("\0")
    .filter(Boolean);
}

function hasStagedChanges() {
  return git(["diff", "--cached", "--quiet"], { allowFailure: true }).status === 1;
}

function acquireLock() {
  try {
    lockHandle = openSync(lockFile, "wx");
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new Error("Another automatic backup is already running.");
    }
    throw error;
  }
}

function releaseLock() {
  if (lockHandle !== undefined) {
    closeSync(lockHandle);
    rmSync(lockFile, { force: true });
  }
}

try {
  acquireLock();
  const branch = git(["branch", "--show-current"]).stdout.trim();
  if (!branch) {
    throw new Error("Automatic backup requires a checked-out branch.");
  }

  if (dryRun) {
    const status = git(["status", "--short", "--untracked-files=all"]).stdout.trim();
    log(status ? `Dry run: changes on ${branch} would be backed up.` : `Dry run: ${branch} has no new files to commit.`);
  } else {
    git(["add", "--all"]);
    const unsafePaths = stagedPaths().filter(isExcludedFromBackup);
    if (unsafePaths.length > 0) {
      throw new Error(`Refusing to back up excluded paths: ${unsafePaths.join(", ")}`);
    }

    if (hasStagedChanges()) {
      git(["commit", "-m", automaticBackupCommitMessage()]);
      log(`Created an automatic backup commit on ${branch}.`);
    } else {
      log(`No new files to commit on ${branch}; checking GitHub for pending commits.`);
    }

    git(["push", "origin", branch]);
    log(`GitHub backup completed for ${branch}.`);
  }
} catch (error) {
  log(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  releaseLock();
}
