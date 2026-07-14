import assert from "node:assert/strict";
import test from "node:test";
import {
  automaticBackupCommitMessage,
  isExcludedFromBackup,
  normalizeGitPath,
} from "./git-backup.mjs";

test("normalizes Windows paths before evaluating a backup", () => {
  assert.equal(normalizeGitPath("src\\app\\page.tsx"), "src/app/page.tsx");
});

test("backs up application source and migrations", () => {
  assert.equal(isExcludedFromBackup("src/app/page.tsx"), false);
  assert.equal(isExcludedFromBackup("supabase/migrations/068_example.sql"), false);
  assert.equal(isExcludedFromBackup("README.md"), false);
});

test("excludes secrets and generated browser output", () => {
  assert.equal(isExcludedFromBackup(".env.local"), true);
  assert.equal(isExcludedFromBackup("certs/production.pem"), true);
  assert.equal(isExcludedFromBackup("output/playwright/screenshot.png"), true);
});

test("creates a timestamped automatic backup commit message", () => {
  assert.equal(
    automaticBackupCommitMessage(new Date("2026-07-14T12:34:56.789Z")),
    "backup: automatic snapshot 2026-07-14T12:34:56Z",
  );
});
