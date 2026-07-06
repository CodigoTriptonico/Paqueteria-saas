import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  collectShipmentInvoiceCopy,
  collectedShipmentInvoiceLabel,
  collectedShipmentInvoiceMessage,
} from "@/lib/shipment-invoice-copy";

describe("shipment invoice copy", () => {
  it("uses cobrar language instead of cerrar", () => {
    const copy = collectShipmentInvoiceCopy(35);

    assert.equal(copy.actionLabel, "Cobrar");
    assert.equal(copy.actionTitle, "Cobrar pendiente");
    assert.equal(copy.dialogTitle, "¿Cobrar pendiente?");
    assert.equal(copy.pendingLineLabel, "Vas a cobrar");
    assert.equal(copy.confirmLabel, "Cobrar $35");
    assert.equal(copy.confirmingLabel, "Cobrando...");
  });

  it("explains that the invoice becomes paid", () => {
    assert.equal(collectedShipmentInvoiceLabel("INV-000002"), "Factura INV-000002 · queda como pagada");
    assert.equal(collectedShipmentInvoiceMessage("INV-000002"), "Invoice INV-000002 cobrado");
  });
});
