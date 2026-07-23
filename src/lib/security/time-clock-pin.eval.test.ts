import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashTimeClockPin, verifyTimeClockPin } from "@/lib/security/time-clock-pin";

describe("time clock authentication security eval", () => {
  it("fails closed for empty, corrupt, and legacy missing hashes", async () => {
    assert.equal(await verifyTimeClockPin("1234", null), false);
    assert.equal(await verifyTimeClockPin("1234", "not-a-hash"), false);
    assert.equal(await verifyTimeClockPin("1234", "scrypt$zz$zz"), false);
  });

  it("does not accept a valid PIN for another employee hash", async () => {
    const employeeA = await hashTimeClockPin("2468");
    const employeeB = await hashTimeClockPin("1357");
    assert.equal(await verifyTimeClockPin("2468", employeeA), true);
    assert.equal(await verifyTimeClockPin("2468", employeeB), false);
  });
});
