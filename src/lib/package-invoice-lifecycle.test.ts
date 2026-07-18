import assert from "node:assert/strict";
import test from "node:test";
import {
  packageInvoiceLifecycleLabel,
  packageInvoiceStateSummary,
} from "./package-invoice-lifecycle";

test("a package invoice preserves payment while its operational state advances", () => {
  assert.equal(packageInvoiceStateSummary({ paymentStatus: "pending", fulfillmentStatus: "created" }), "Creada");
  assert.equal(packageInvoiceStateSummary({ paymentStatus: "paid", fulfillmentStatus: "created" }), "Pagada");
  assert.equal(packageInvoiceStateSummary({ paymentStatus: "paid", fulfillmentStatus: "in_warehouse" }), "En bodega");
  assert.equal(packageInvoiceStateSummary({ paymentStatus: "pending", fulfillmentStatus: "in_transit" }), "En tránsito");
  assert.equal(packageInvoiceLifecycleLabel.delivered, "Entregada");
});
