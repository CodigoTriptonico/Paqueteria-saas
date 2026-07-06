import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PAYMENT_METHOD,
  isPaymentMethod,
  PAYMENT_METHOD_OPTIONS,
  paymentMethodLabel,
} from "@/lib/payment-methods";

describe("payment methods", () => {
  it("covers common counter payment methods", () => {
    const methods = PAYMENT_METHOD_OPTIONS.map((option) => option.value);

    assert.deepEqual(methods, [
      "cash",
      "card",
      "check",
      "zelle",
      "venmo",
      "paypal",
      "cash_app",
      "bank_transfer",
      "deposit",
      "other",
    ]);
  });

  it("validates and labels methods", () => {
    assert.equal(DEFAULT_PAYMENT_METHOD, "cash");
    assert.equal(isPaymentMethod("zelle"), true);
    assert.equal(isPaymentMethod("crypto"), false);
    assert.equal(paymentMethodLabel("card"), "Tarjeta");
  });
});
