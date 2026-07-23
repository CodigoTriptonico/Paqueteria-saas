import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const read = (name) =>
  readFileSync(join(process.cwd(), "scripts", name), "utf8");

describe("database integration harness transaction recovery eval", () => {
  it("keeps expected authorization failures from aborting later assertions", () => {
    for (const file of [
      "test-business-model.mjs",
      "test-commercial-config.mjs",
    ]) {
      const source = read(file);
      assert.match(source, /savepoint authenticated_scope_/);
      assert.match(source, /rollback to savepoint/);
      assert.match(source, /release savepoint/);
      assert.match(source, /throw error/);
    }
  });
});
