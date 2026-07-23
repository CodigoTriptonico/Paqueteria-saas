import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hashTimeClockPin,
  validateTimeClockPin,
  verifyTimeClockPin,
} from "@/lib/security/time-clock-pin";

describe("time clock PIN", () => {
  it("hashes with a random salt and verifies without storing plaintext", async () => {
    const first = await hashTimeClockPin("4829");
    const second = await hashTimeClockPin("4829");
    assert.notEqual(first, second);
    assert.doesNotMatch(first, /4829/);
    assert.equal(await verifyTimeClockPin("4829", first), true);
    assert.equal(await verifyTimeClockPin("4828", first), false);
  });

  it("rejects weak or malformed PIN values", () => {
    assert.throws(() => validateTimeClockPin("123"));
    assert.throws(() => validateTimeClockPin("abcd"));
    assert.equal(validateTimeClockPin("123456"), "123456");
  });
});
