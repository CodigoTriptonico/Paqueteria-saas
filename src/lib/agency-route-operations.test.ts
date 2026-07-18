import assert from "node:assert/strict";
import test from "node:test";
import { agencyPaymentApplicationTotal, agencyVisitCanClose } from "@/lib/agency-route-operations";

test("agency visit requires a reason for a quantity difference", () => {
  assert.equal(agencyVisitCanClose({ requested: 4, confirmed: 3 }), false);
  assert.equal(agencyVisitCanClose({ requested: 4, confirmed: 3, differenceReason: "Faltó una caja" }), true);
});

test("agency payment total is deterministic", () => {
  assert.equal(agencyPaymentApplicationTotal([{ amountCents: 125 }, { amountCents: 75 }]), 200);
});
