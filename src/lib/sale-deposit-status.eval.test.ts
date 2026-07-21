import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const fieldSource = readFileSync(
  join(root, "src/components/sale/sale-payment-method-field.tsx"),
  "utf8",
);
const paymentSource = readFileSync(join(root, "src/lib/sale-payment-choice.ts"), "utf8");
const billingSource = readFileSync(join(root, "src/lib/invoice-billing.ts"), "utf8");
const shipmentActionSource = readFileSync(join(root, "src/app/actions/shipments.ts"), "utf8");
const invoiceSource = readFileSync(
  join(root, "src/components/sale/venta-parts.tsx"),
  "utf8",
);

describe("sale deposit status UI", () => {
  it("offers one channel-neutral pending state and records no money while pending", () => {
    assert.match(fieldSource, /Depósito pendiente/);
    assert.match(fieldSource, /Estado: pendiente/);
    assert.doesNotMatch(fieldSource, /Conductor cobra|Cobrar ahora/);
    assert.doesNotMatch(fieldSource, /pendingPaymentSource/);
    assert.match(paymentSource, /choice === "pending"/);
    assert.match(paymentSource, /paid: "\$0"/);
    assert.match(paymentSource, /paymentMethod: undefined/);
  });

  it("persists required amount and status separately from money received", () => {
    assert.match(billingSource, /depositRequired: string/);
    assert.match(billingSource, /depositStatus: "pending" \| "paid"/);
    assert.match(billingSource, /depositStatusForPayment/);
    assert.match(shipmentActionSource, /payment_kind: paymentKind/);
    assert.match(shipmentActionSource, /invoicePaymentKindForCurrentDeposit/);
    assert.match(invoiceSource, /billing\?\.depositStatus === "pending"/);
    assert.match(invoiceSource, /billing\?\.depositRequired/);
  });
});
