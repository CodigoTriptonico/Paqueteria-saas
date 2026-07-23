import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(new URL("./test-sms-flow.mjs", import.meta.url), "utf8");

describe("local SMS integration script", () => {
  it("loads .env.local with an explicit fs import", () => {
    assert.match(source, /import fs from "node:fs"/);
    assert.match(source, /fs\.existsSync\(envPath\)/);
  });

  it("always removes temporary auth and organization data", () => {
    assert.match(source, /async function removeTestData/);
    assert.match(source, /finally \{[\s\S]*await removeTestData/);
    assert.match(source, /admin\.auth\.admin\.deleteUser/);
    assert.match(source, /organizations"\)\.delete\(\)/);
  });

  it("returns a failing process status when the OTP request fails", () => {
    assert.match(source, /throw new Error\(`Fallo al solicitar el OTP/);
    assert.match(source, /process\.exitCode = 1/);
  });

  it("only permits an explicit local provider skip", () => {
    assert.match(source, /otpError\.message === "Unsupported phone provider"/);
    assert.match(source, /process\.env\.REQUIRE_SMS_PROVIDER !== "1"/);
    assert.match(source, /Flujo SMS: SKIPPED/);
  });
});
