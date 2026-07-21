import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const invoiceSource = readFileSync(join(root, "src/components/sale/venta-parts.tsx"), "utf8");
const saleSource = readFileSync(join(root, "src/components/venta-client.tsx"), "utf8");
const quickCheckoutSource = readFileSync(
  join(root, "src/components/sale/sale-quick-checkout-modal.tsx"),
  "utf8",
);

describe("sale invoice service contract", () => {
  it("uses the explicit logistics operation instead of parsing the combined summary", () => {
    assert.match(invoiceSource, /serviceOperation: LogisticsTaskType/);
    assert.match(invoiceSource, /saleInvoiceServiceLabel\(serviceOperation\)/);
    assert.doesNotMatch(invoiceSource, /function invoiceServiceLabel/);
    assert.doesNotMatch(invoiceSource, /hasPickup|hasDelivery/);
  });

  it("keeps every current empty-box sale invoice classified as delivery", () => {
    assert.match(saleSource, /serviceOperation: "deliver_empty_box"/);
    assert.match(saleSource, /serviceOperation=\{createdInvoice\.serviceOperation\}/);
    assert.match(saleSource, /serviceOperation="deliver_empty_box"/);
    assert.match(quickCheckoutSource, /serviceOperation="deliver_empty_box"/);
  });
});
