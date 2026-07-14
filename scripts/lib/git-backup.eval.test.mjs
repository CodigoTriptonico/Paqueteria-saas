import assert from "node:assert/strict";
import test from "node:test";
import { isExcludedFromBackup } from "./git-backup.mjs";

test("hourly backup covers an unfinished feature without exposing future credentials", () => {
  const unfinishedFeatureFiles = [
    "src/components/distribution/dashboard.tsx",
    "src/app/actions/distribution.ts",
    "supabase/migrations/065_distribution_partners.sql",
  ];

  assert.deepEqual(
    unfinishedFeatureFiles.filter(isExcludedFromBackup),
    [],
  );
  assert.equal(isExcludedFromBackup(".env.production"), true);
});
