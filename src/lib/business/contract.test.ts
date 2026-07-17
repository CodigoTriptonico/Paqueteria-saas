import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addMoney,
  assertIdempotencyKey,
  isAgencyTransitionAllowed,
  isRequestTransitionAllowed,
  money,
} from "@/lib/business/contract";

describe("business contract", () => {
  it("keeps every financial amount in integer USD cents", () => {
    assert.deepEqual(addMoney([money(1_250), money(750)]), { currency: "USD", amountCents: 2_000 });
    assert.throws(() => money(1.5), /centavos enteros/);
  });

  it("requires stable idempotency keys", () => {
    assert.equal(assertIdempotencyKey("sale:01HZY8W3G4V5N6M7"), "sale:01HZY8W3G4V5N6M7");
    assert.throws(() => assertIdempotencyKey("short"), /idempotencia/);
  });

  it("prevents skipped and terminal state transitions", () => {
    assert.equal(isAgencyTransitionAllowed("prospect", "active"), false);
    assert.equal(isAgencyTransitionAllowed("activation_pending", "active"), true);
    assert.equal(isAgencyTransitionAllowed("closed", "active"), false);
    assert.equal(isRequestTransitionAllowed("draft", "submitted"), true);
    assert.equal(isRequestTransitionAllowed("completed", "in_route"), false);
  });
});
