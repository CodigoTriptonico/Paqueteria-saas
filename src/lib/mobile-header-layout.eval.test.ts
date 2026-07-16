import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

describe("mobile header layout eval", () => {
  it("does not let account text consume the narrow app-shell header", () => {
    const menu = source("src/components/user-account-menu.tsx");

    assert.match(menu, /h-10 w-10[\s\S]*sm:h-auto sm:w-auto/);
    assert.match(menu, /hidden min-w-0 flex-1 sm:block/);
    assert.doesNotMatch(menu, /: "flex items-center gap-2 overflow-hidden rounded-lg border border-black bg-surface-card px-2/);
  });

  it("uses a viewport-bound disclosure on phones and an anchored one from small screens up", () => {
    const conductorTasks = source("src/components/conductor/conductor-tareas-client.tsx");

    assert.match(conductorTasks, /fixed inset-x-4 top-1\/2/);
    assert.match(conductorTasks, /sm:absolute sm:inset-x-auto sm:top-full/);
    assert.match(conductorTasks, /align === "right" \? "sm:right-0" : "sm:left-0"/);
  });

  it("prevents the employee clock form from expanding an implicit mobile grid column", () => {
    const clockUser = source("src/components/time-clock/clock-user-client.tsx");

    assert.match(clockUser, /grid-cols-\[minmax\(0,1fr\)\]/);
    assert.doesNotMatch(clockUser, /grid min-h-dvh place-items-center bg-\[#17201e\]/);
  });
});
