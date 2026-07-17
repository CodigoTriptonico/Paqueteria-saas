import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const source = readFileSync(join(process.cwd(), "src", "app", "login", "login-form.tsx"), "utf8");

describe("login password visibility eval", () => {
  it("preserves a labeled password input and an explicit visible-password state", () => {
    assert.match(source, /<label[\s\S]*?htmlFor="login-password"[\s\S]*?Contrasena[\s\S]*?<\/label>/);
    assert.match(source, /type=\{showPassword \? "text" : "password"\}/);
    assert.match(source, /aria-label=\{showPassword \? "Ocultar contrase/);
  });
});
