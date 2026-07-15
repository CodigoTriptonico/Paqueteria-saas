import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";

const appShellSource = readFileSync(
  join(process.cwd(), "src", "components", "app-shell.tsx"),
  "utf8",
);
const mainClassName =
  appShellSource.match(/<main className="([^"]+)">/)?.[1] ?? "";
const mainClassTokens = mainClassName.split(/\s+/);

test("app shell lets mobile use document scroll", () => {
  assert.equal(mainClassName, "flex min-h-dvh flex-col bg-surface-shell text-[#f8fafc] lg:h-dvh lg:overflow-hidden");
  assert.equal(mainClassTokens.includes("h-dvh"), false);
  assert.equal(mainClassTokens.includes("overflow-hidden"), false);
  assert.equal(mainClassTokens.includes("min-h-dvh"), true);
  assert.equal(mainClassTokens.includes("lg:h-dvh"), true);
  assert.equal(mainClassTokens.includes("lg:overflow-hidden"), true);
  assert.match(appShellSource, /overflow-visible lg:min-h-0 lg:overflow-hidden/);
});

test("app shell keeps desktop content scroll isolated", () => {
  assert.match(
    appShellSource,
    /className="flex flex-col overflow-x-hidden pb-24 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pb-0"/,
  );
});
