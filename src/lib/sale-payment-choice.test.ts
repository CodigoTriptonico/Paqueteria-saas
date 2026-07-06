import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  resolveSalePaymentInput,
  salePaymentChoiceLabel,
} from "@/lib/sale-payment-choice";

const confirmDialogSource = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../components/sale/sale-invoice-confirm-dialog.tsx",
  ),
  "utf8",
);
const fieldSource = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../components/sale/sale-payment-method-field.tsx",
  ),
  "utf8",
);

describe("sale payment choice", () => {
  it("keeps pending invoices without a recorded payment", () => {
    assert.deepEqual(
      resolveSalePaymentInput({
        choice: "pending",
        payNow: "$40",
        paymentNote: "no cobrar",
      }),
      {
        paid: "$0",
        paymentMethod: undefined,
        paymentNote: "",
      },
    );
  });

  it("records a deposit when a real payment method is chosen", () => {
    assert.deepEqual(
      resolveSalePaymentInput({
        choice: "cash",
        payNow: "$40",
        paymentNote: " billete ",
      }),
      {
        paid: "$40",
        paymentMethod: "cash",
        paymentNote: "billete",
      },
    );
  });

  it("labels pending clearly in the inline payment field", () => {
    assert.equal(salePaymentChoiceLabel("pending"), "Pendiente");
    assert.equal(fieldSource.includes("openPaymentSelect"), true);
    assert.equal(fieldSource.includes("select.showPicker"), true);
    assert.equal(fieldSource.includes("salePaymentChoiceLabel(value)"), true);
    assert.equal(fieldSource.includes("setExpanded"), false);
  });

  it("shows the collapsed payment field only in the create-invoice confirm dialog", () => {
    assert.equal(confirmDialogSource.includes("SalePaymentMethodField"), true);
    assert.equal(confirmDialogSource.includes("onPaymentMethodChange"), true);
  });
});
