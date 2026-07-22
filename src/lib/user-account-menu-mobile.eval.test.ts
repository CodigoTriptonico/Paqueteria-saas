import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const source = readFileSync(
  join(process.cwd(), "src", "components", "user-account-menu.tsx"),
  "utf8",
);

describe("mobile account menu presentation eval", () => {
  it("keeps the compact mobile header clear while preserving the desktop account card", () => {
    assert.match(source, /rounded-full border border-transparent bg-transparent p-0/);
    assert.match(source, /hover:bg-emerald-400\/10/);
    assert.match(source, /sm:h-auto sm:w-auto sm:gap-3 sm:rounded-lg sm:border-black sm:bg-surface-card/);
    assert.doesNotMatch(source, /w-10 items-center justify-center overflow-hidden rounded-lg border border-black bg-surface-card p-0/);
  });
});
