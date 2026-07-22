import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const source = readFileSync(
  join(process.cwd(), "src", "components", "user-account-menu.tsx"),
  "utf8",
);

describe("mobile account menu trigger", () => {
  it("uses the circular avatar as the only visible mobile control", () => {
    assert.match(
      source,
      /h-10 w-10 items-center justify-center rounded-full border border-transparent bg-transparent/,
    );
    assert.match(source, /sm:rounded-lg sm:border-black sm:bg-surface-card/);
    assert.match(source, /rounded-full border border-black bg-emerald-600/);
  });
});
