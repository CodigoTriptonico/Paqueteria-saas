import assert from "node:assert/strict";
import test from "node:test";
import { coercePhoneInput, formatPhoneForInput } from "@/lib/phone/format-input";
import { PHONE_MAX_DIGITS } from "@/lib/phone/normalize";

test("formats NANP 10-digit numbers as 3-3-4", () => {
  assert.equal(coercePhoneInput("3055550100"), "305-555-0100");
  assert.equal(coercePhoneInput("305555"), "305-555");
});

test("formats NANP 11-digit numbers with country code 1", () => {
  assert.equal(coercePhoneInput("13055550100"), "1-305-555-0100");
  assert.equal(coercePhoneInput("+13055550100"), "+1-305-555-0100");
});

test("caps digits at E.164 maximum", () => {
  const overflow = "6".repeat(20);
  const result = coercePhoneInput(overflow);
  assert.equal(result.replace(/\D/g, "").length, PHONE_MAX_DIGITS);
});

test("preserves leading plus while typing", () => {
  assert.equal(coercePhoneInput("+"), "+");
  assert.equal(coercePhoneInput("+1"), "+1");
});

test("strips non-digits except leading plus context", () => {
  assert.equal(coercePhoneInput("305 555 01 00"), "305-555-0100");
  assert.equal(coercePhoneInput("(305) 555-0100"), "305-555-0100");
});

test("formats long international strings with hyphens", () => {
  assert.equal(formatPhoneForInput("525551234567", true), "+52-555-123-4567");
});
