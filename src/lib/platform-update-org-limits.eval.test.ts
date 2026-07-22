import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const source = readFileSync(
  join(process.cwd(), "src/app/actions/platform.ts"),
  "utf8",
);

describe("platform update organization user limits", () => {
  it("accepts null maxUsers and clears the stored plan cap", () => {
    assert.match(source, /maxUsers\?: number \| null/);
    assert.match(source, /if \(input\.maxUsers === null\) \{/);
    assert.match(source, /delete settings\.max_users/);
  });

  it("rejects non-finite numeric plan caps before writing settings", () => {
    assert.match(source, /Number\.isFinite\(input\.maxWarehouses\)/);
    assert.match(source, /Number\.isFinite\(input\.maxUsers\)/);
  });
});
