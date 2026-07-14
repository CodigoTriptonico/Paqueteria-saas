import assert from "node:assert/strict";
import test from "node:test";
import { generateTemporaryPassword } from "@/lib/auth/temporary-password";

test("generateTemporaryPassword preserves the ten-character unambiguous alphabet contract", () => {
  assert.equal(generateTemporaryPassword(() => 0), "AAAAAAAAAA");
  assert.equal(generateTemporaryPassword(() => 0.999999), "9999999999");
  assert.match(generateTemporaryPassword(() => 0.5), /^[A-HJ-NP-Za-km-z2-9]{10}$/);
});
