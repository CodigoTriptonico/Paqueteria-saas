import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  defaultSalePaymentSelection,
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

  it("defaults every sale to a payment received now", () => {
    assert.equal(defaultSalePaymentSelection(), "cash");
  });

  it("uses one pending-deposit checkbox for every delivery channel", () => {
    assert.equal(salePaymentChoiceLabel("pending"), "Pendiente");
    assert.equal(fieldSource.includes("openPaymentSelect"), true);
    assert.equal(fieldSource.includes("select.showPicker"), true);
    assert.equal(fieldSource.includes("Cobro del depósito"), true);
    assert.equal(fieldSource.includes("Conductor cobra"), false);
    assert.equal(fieldSource.includes("Cobrar ahora"), false);
    assert.equal(fieldSource.includes("Depósito pendiente"), true);
    assert.equal(fieldSource.includes('type="checkbox"'), true);
    assert.equal(fieldSource.includes("Estado: pendiente"), true);
    assert.equal(fieldSource.includes("No se registra en caja hasta que se cobre"), true);
    assert.equal(fieldSource.includes("pendingPaymentSource"), false);
    assert.equal(fieldSource.includes("SALE_PAYMENT_UNSET"), true);
    assert.equal(fieldSource.includes("paymentUnset"), true);
    assert.equal(confirmDialogSource.includes("paymentSelectionRequired"), true);
    assert.equal(confirmDialogSource.includes("Elige cómo cobrar"), true);
  });

  it("shows the collapsed payment field only in the create-invoice confirm dialog", () => {
    assert.equal(confirmDialogSource.includes("SalePaymentMethodField"), true);
    assert.equal(confirmDialogSource.includes("onPaymentMethodChange"), true);
    assert.equal(confirmDialogSource.includes("pendingCollectionAmount"), false);
    assert.equal(confirmDialogSource.includes("pendingPaymentSource"), false);
  });
});
