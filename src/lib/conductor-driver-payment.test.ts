import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  conductorCollectionAuditDescription,
  conductorExpectedDepositCollection,
  conductorPaymentChoiceError,
  isConductorPaymentChoice,
  resolveConductorPaymentAmount,
  settleConductorPayment,
} from "@/lib/conductor-driver-payment";

describe("conductor driver payment", () => {
  it("collects only an outstanding deposit during empty-box delivery", () => {
    assert.equal(
      conductorExpectedDepositCollection({
        result: "completed",
        taskType: "deliver_empty_box",
        depositDue: 20,
        balanceDue: 100,
      }),
      20,
    );
    assert.equal(
      conductorExpectedDepositCollection({
        result: "completed",
        taskType: "deliver_empty_box",
        depositDue: 0,
        balanceDue: 80,
      }),
      0,
    );
    assert.equal(
      conductorExpectedDepositCollection({
        result: "completed",
        taskType: "pickup_full_box",
        depositDue: 20,
        balanceDue: 100,
      }),
      0,
    );
  });

  it("requires an explicit collection outcome and a valid custom amount", () => {
    assert.equal(conductorPaymentChoiceError({ choice: null, expectedAmount: 20, customAmount: 0 }), "Indica si recibiste el depósito.");
    assert.equal(conductorPaymentChoiceError({ choice: "custom", expectedAmount: 20, customAmount: 0 }), "Indica un monto recibido válido.");
    assert.equal(conductorPaymentChoiceError({ choice: "none", expectedAmount: 20, customAmount: 0 }), null);
    assert.equal(isConductorPaymentChoice("expected"), true);
    assert.equal(isConductorPaymentChoice("pending"), false);
  });

  it("keeps no collection as pending money, not a payment method", () => {
    assert.deepEqual(resolveConductorPaymentAmount({ choice: "none", expectedAmount: 20, customAmount: 0 }), { amount: 0, outcome: "not_collected" });
    assert.match(conductorCollectionAuditDescription({ expectedAmount: 20, receivedAmount: 0, outcome: "not_collected" }), /cobro queda pendiente/);
  });

  it("records expected and custom amounts precisely", () => {
    assert.deepEqual(resolveConductorPaymentAmount({ choice: "expected", expectedAmount: 20.239, customAmount: 0 }), { amount: 20.24, outcome: "collected" });
    assert.deepEqual(resolveConductorPaymentAmount({ choice: "custom", expectedAmount: 20, customAmount: 7.5 }), { amount: 7.5, outcome: "collected" });
  });

  it("preserves a balance for a partial collection and accommodates an overpayment", () => {
    assert.deepEqual(settleConductorPayment({ quotedTotal: 100, alreadyPaid: 20, receivedAmount: 30 }), {
      paid: 50,
      balanceDue: 50,
      adjustedQuotedTotal: 100,
      totalAdjusted: false,
      totalAdjustment: 0,
      isPaidInFull: false,
    });
    assert.deepEqual(settleConductorPayment({ quotedTotal: 100, alreadyPaid: 90, receivedAmount: 20 }), {
      paid: 110,
      balanceDue: 0,
      adjustedQuotedTotal: 110,
      totalAdjusted: true,
      totalAdjustment: 10,
      isPaidInFull: true,
    });
  });
});
