import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  defaultSalePaymentSelection,
  resolveSalePaymentInput,
  SALE_PAYMENT_UNSET,
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

  it("defaults office counter sales to cash and driver deliveries to unset", () => {
    assert.equal(defaultSalePaymentSelection("office"), "cash");
    assert.equal(defaultSalePaymentSelection("driver"), SALE_PAYMENT_UNSET);
  });

  it("makes pending a conductor collection decision, not an ambiguous payment method", () => {
    assert.equal(salePaymentChoiceLabel("pending"), "Pendiente");
    assert.equal(fieldSource.includes("openPaymentSelect"), true);
    assert.equal(fieldSource.includes("select.showPicker"), true);
    assert.equal(fieldSource.includes("¿Cómo se cobra el depósito?"), true);
    assert.equal(fieldSource.includes("Conductor cobra"), true);
    assert.equal(fieldSource.includes(">Al entregar</span>"), false);
    assert.equal(fieldSource.includes("Cobrar ahora"), true);
    assert.equal(fieldSource.includes("Ya recibido"), false);
    assert.equal(fieldSource.includes("Cobro pendiente del conductor"), true);
    assert.equal(fieldSource.includes("Pago pendiente en oficina"), true);
    assert.equal(fieldSource.includes("Depósito pendiente"), true);
    assert.equal(fieldSource.includes('type="checkbox"'), true);
    assert.equal(fieldSource.includes("Cobro del depósito"), true);
    assert.equal(fieldSource.includes("Dejar pendiente"), false);
    assert.equal(fieldSource.includes("Se cobra después"), false);
    assert.equal(fieldSource.includes("ActionConfirmDialog"), false);
    assert.equal(fieldSource.includes("pendingConfirmOpen"), false);
    assert.equal(fieldSource.includes("onAfterPendingConfirmed"), false);
    assert.equal(fieldSource.includes("pendingConfirmCreatesInvoice"), false);
    assert.equal(fieldSource.includes("El invoice impreso llevará el depósito de"), true);
    assert.equal(fieldSource.includes("no recibido hasta que el conductor registre el cobro"), true);
    assert.equal(fieldSource.includes("no se registrará en caja"), true);
    assert.equal(fieldSource.includes("SALE_PAYMENT_UNSET"), true);
    assert.equal(fieldSource.includes("counterPaymentSelected"), true);
    assert.equal(fieldSource.includes("paymentUnset"), true);
    assert.equal(confirmDialogSource.includes("paymentSelectionRequired"), true);
    assert.equal(confirmDialogSource.includes("Elige cómo cobrar"), true);
    assert.equal(fieldSource.includes("setExpanded"), false);
  });

  it("shows the collapsed payment field only in the create-invoice confirm dialog", () => {
    assert.equal(confirmDialogSource.includes("SalePaymentMethodField"), true);
    assert.equal(confirmDialogSource.includes("onPaymentMethodChange"), true);
    assert.equal(confirmDialogSource.includes("pendingCollectionAmount"), false);
    assert.equal(confirmDialogSource.includes("pendingPaymentSource"), true);
  });
});
