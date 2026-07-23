import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "src/lib/auth/permissions.ts"), "utf8");

test("authenticated navigation uses an explicit default-deny rule", () => {
  assert.match(source, /const required = PATH_PERMISSIONS\[base\]/);
  assert.match(source, /if \(!required\?\.length\) \{\s*return false;/);
  assert.match(source, /pathname === "\/"/);
  assert.match(source, /"\/reloj": \["time_clock\.view", "time_clock\.manage"\]/);
});
