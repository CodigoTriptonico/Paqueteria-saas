import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(new URL("./test-sms-flow.mjs", import.meta.url), "utf8");

describe("SMS integration hygiene eval", () => {
  it("uses isolated synthetic identities and does not retain them after the test", () => {
    assert.match(source, /test-paqueteria-flow@example\.com/);
    assert.match(source, /Test Paqueteria Flow/);
    assert.match(source, /await removeTestData\(admin, testEmail, testPhone, testOrgName\)/);
  });

  it("keeps credential-bearing execution behind the local-only guard", () => {
    assert.match(source, /assertLocalCredentialScript\(\)/);
    assert.match(source, /NEXT_PUBLIC_SUPABASE_URL/);
    assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("makes a real provider mandatory when release verification requests it", () => {
    assert.match(source, /REQUIRE_SMS_PROVIDER/);
    assert.match(source, /Unsupported phone provider/);
    assert.match(source, /throw new Error\(`Fallo al solicitar el OTP/);
  });
});
