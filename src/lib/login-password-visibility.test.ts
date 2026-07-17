import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const source = readFileSync(join(process.cwd(), "src", "app", "login", "login-form.tsx"), "utf8");

describe("login password visibility control", () => {
  it("keeps the eye button outside the password label so mobile taps reach the button", () => {
    assert.match(source, /htmlFor="login-password"/);
    assert.match(source, /id="login-password"/);
    assert.match(source, /onClick=\{\(\) => setShowPassword\(\(value\) => !value\)\}/);
    assert.match(
      source,
      /htmlFor="login-password"[\s\S]*?<\/label>\s*<div className="relative">[\s\S]*?setShowPassword/,
    );
  });
});
