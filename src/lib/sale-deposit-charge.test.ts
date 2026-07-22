import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultSaleDepositDraft,
  resolveSaleDepositChargeAmount,
  saleDepositChargeAmountDigits,
} from "@/lib/sale-deposit-charge";

describe("sale-deposit-charge", () => {
  it("defaults deposit to the configured minimum capped by the total", () => {
    assert.equal(
      resolveSaleDepositChargeAmount({
        mode: "deposit",
        depositDraft: "",
        minimumDeposit: "$20",
        quotedTotal: "$500",
      }),
      20,
    );
    assert.equal(
      resolveSaleDepositChargeAmount({
        mode: "deposit",
        depositDraft: "",
        minimumDeposit: "$20",
        quotedTotal: "$15",
      }),
      15,
    );
    assert.equal(defaultSaleDepositDraft("$20", "$500"), "20");
  });

  it("uses the edited deposit amount and never exceeds the total", () => {
    assert.equal(
      resolveSaleDepositChargeAmount({
        mode: "deposit",
        depositDraft: "100",
        minimumDeposit: "$20",
        quotedTotal: "$500",
      }),
      100,
    );
    assert.equal(
      resolveSaleDepositChargeAmount({
        mode: "deposit",
        depositDraft: "900",
        minimumDeposit: "$20",
        quotedTotal: "$500",
      }),
      500,
    );
  });

  it("locks full payment to the quoted total", () => {
    assert.equal(
      resolveSaleDepositChargeAmount({
        mode: "full",
        depositDraft: "20",
        minimumDeposit: "$20",
        quotedTotal: "$500",
      }),
      500,
    );
    assert.equal(
      saleDepositChargeAmountDigits({
        mode: "full",
        depositDraft: "20",
        minimumDeposit: "$20",
        quotedTotal: "$500",
      }),
      "500",
    );
  });
});
