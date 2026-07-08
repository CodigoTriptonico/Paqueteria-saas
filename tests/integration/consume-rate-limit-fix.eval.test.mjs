import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

const root = process.cwd();
const migrationSource = readFileSync(
  join(root, "supabase", "migrations", "048_fix_consume_rate_limit_ambiguous_column.sql"),
  "utf8",
);

describe("048 consume_rate_limit ambiguous column fix", () => {
  it("uses v_window_start instead of a variable named window_start", () => {
    assert.match(migrationSource, /v_window_start timestamptz/);
    assert.match(migrationSource, /values \(p_bucket, p_key, v_window_start, 1\)/);
    assert.doesNotMatch(migrationSource, /declare\s+window_start timestamptz/s);
  });
});
