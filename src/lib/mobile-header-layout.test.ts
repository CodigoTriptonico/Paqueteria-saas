import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

test("the mobile account control is a 40px icon trigger while the desktop label remains available", () => {
  const menu = source("src/components/user-account-menu.tsx");

  assert.match(menu, /flex h-10 w-10 items-center justify-center[\s\S]*sm:h-auto sm:w-auto/);
  assert.match(menu, /relative hidden min-w-0 flex-1 sm:block/);
  assert.match(menu, /hidden h-4 w-4 shrink-0[\s\S]*sm:block/);
});

test("conductor information disclosures stay inside a phone viewport", () => {
  const conductorTasks = source("src/components/conductor/conductor-tareas-client.tsx");

  assert.match(conductorTasks, /fixed inset-x-4 top-1\/2[\s\S]*-translate-y-1\/2/);
  assert.match(conductorTasks, /sm:absolute sm:inset-x-auto sm:top-full[\s\S]*sm:max-w-\[calc\(100vw-2rem\)\]/);
});

test("the employee clock entry form uses the available mobile grid track", () => {
  const clockUser = source("src/components/time-clock/clock-user-client.tsx");

  assert.match(clockUser, /grid-cols-\[minmax\(0,1fr\)\] place-items-center/);
  assert.match(clockUser, /<form[\s\S]*className="w-full max-w-sm/);
});
