import assert from "node:assert/strict";
import test from "node:test";
import {
  availableDistributionCredit,
  canCreateDistributionCharge,
  distributionBalance,
} from "./ledger";

test("sums only the matrix receivable ledger", () => {
  assert.equal(
    distributionBalance([
      { kind: "charge", amount: 150, createdAt: "2026-01-01" },
      { kind: "payment", amount: -80, createdAt: "2026-01-02" },
      { kind: "reversal", amount: -20, createdAt: "2026-01-03" },
    ]),
    50,
  );
});

test("blocks a wholesale charge that exceeds available credit", () => {
  assert.equal(availableDistributionCredit(500, 350), 150);
  assert.equal(canCreateDistributionCharge({ creditLimit: 500, balance: 350, wholesalePrice: 150 }), true);
  assert.equal(canCreateDistributionCharge({ creditLimit: 500, balance: 350, wholesalePrice: 151 }), false);
});
