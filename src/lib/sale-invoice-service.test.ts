import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  saleInvoiceEtaLabel,
  saleInvoiceServiceLabel,
} from "@/lib/sale-invoice-service";

describe("sale invoice service", () => {
  it("labels the empty-box movement as delivery", () => {
    assert.equal(saleInvoiceServiceLabel("deliver_empty_box"), "Servicio de entrega");
  });

  it("labels the full-box movement as pickup", () => {
    assert.equal(saleInvoiceServiceLabel("pickup_full_box"), "Servicio de recoleccion");
  });

  it("keeps the estimated time as compact secondary copy", () => {
    assert.equal(saleInvoiceEtaLabel(" 7-14 dias "), "Entrega est. 7-14 dias");
    assert.equal(saleInvoiceEtaLabel(undefined), "");
  });
});
