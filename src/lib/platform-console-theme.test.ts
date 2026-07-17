import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const source = readFileSync(
  join(process.cwd(), "src/components/platform/platform-console.tsx"),
  "utf8",
);

describe("platform companies theme", () => {
  it("keeps platform administration on shared dark surfaces", () => {
    assert.match(source, /rounded-xl border border-black bg-surface-card px-5 py-5/);
    assert.match(source, /rounded-xl border border-black bg-surface-card p-4 text-left/);
    assert.doesNotMatch(source, /from-emerald-300 via-teal-300 to-cyan-300/);
    assert.doesNotMatch(source, /from-emerald-400 via-teal-300 to-cyan-300/);
  });
});
