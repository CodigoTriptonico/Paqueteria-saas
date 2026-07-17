import assert from "node:assert/strict";
import test from "node:test";
import {
  addUsd,
  journalIsBalanced,
  multiplyUsd,
  openBalanceStatus,
  paymentApplicationStatus,
  remainingCents,
  usd,
} from "./money";

test("USD conserva centavos enteros sin redondeo flotante", () => {
  assert.deepEqual(addUsd(usd(125), usd(875)), usd(1_000));
  assert.deepEqual(multiplyUsd(usd(1_250), 3), usd(3_750));
  assert.throws(() => usd(10.5), /entero seguro/);
});

test("saldo y estados se derivan de aplicaciones y reversos", () => {
  assert.equal(remainingCents(10_000, 2_500), 7_500);
  assert.equal(openBalanceStatus(10_000, 0), "pending");
  assert.equal(openBalanceStatus(10_000, 2_500), "partially_paid");
  assert.equal(openBalanceStatus(10_000, 7_500, 2_500), "paid");
  assert.equal(paymentApplicationStatus(10_000, 0), "received");
  assert.equal(paymentApplicationStatus(10_000, 2_500), "partially_applied");
  assert.equal(paymentApplicationStatus(10_000, 10_000), "applied");
});

test("un asiento exige dos o más líneas y débitos iguales a créditos", () => {
  assert.equal(journalIsBalanced([{ debitCents: 500, creditCents: 0 }]), false);
  assert.equal(journalIsBalanced([
    { debitCents: 500, creditCents: 0 },
    { debitCents: 0, creditCents: 500 },
  ]), true);
  assert.equal(journalIsBalanced([
    { debitCents: 500, creditCents: 0 },
    { debitCents: 0, creditCents: 499 },
  ]), false);
});
