import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/078_fix_matrix_initialization_role_alias.sql"),
  "utf8",
);

describe("matrix initialization role aliases", () => {
  it("keeps PL/pgSQL records distinct from SQL role aliases", () => {
    assert.match(migration, /member_role record;/);
    assert.doesNotMatch(migration, /\n\s*role record;/);
    assert.match(migration, /from public\.roles as matrix_role/);
    assert.match(migration, /join public\.roles as assigned_role/);
    assert.match(migration, /for member_role in/);
  });
});
