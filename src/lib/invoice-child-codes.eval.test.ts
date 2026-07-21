import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("new shipments persist one child invoice per physical box without splitting the sale", async () => {
  const source = await readFile(new URL("../app/actions/shipments.ts", import.meta.url), "utf8");

  assert.match(source, /invoiceBoxCode\(shipment\.code, index\)/);
  assert.match(source, /shipment_id: shipment\.id/);
  assert.match(source, /invoice_code: invoiceBoxCode/);
});

test("the completed sale prints box invoices only when there are two or more boxes", async () => {
  const [saleSource, invoiceSource] = await Promise.all([
    readFile(new URL("../components/venta-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/sale/venta-parts.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(saleSource, /printableBoxInvoiceCodes\(invoiceNumber, boxCount\)/);
  assert.match(saleSource, /One-box sales print only the parent invoice/);
  assert.match(saleSource, /parentInvoiceNumber=\{createdInvoice\.invoiceNumber\}/);
  assert.match(invoiceSource, /Factura principal/);
});

test("field and warehouse screens use the individual box invoice, not only the sale number", async () => {
  const [taskSource, conductorSource, warehouseSource] = await Promise.all([
    readFile(new URL("./conductor-tasks.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/conductor/conductor-tareas-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/warehouse/warehouse-intake-client.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(taskSource, /boxInvoiceCodes: invoiceBoxCodes\(shipment\.code, boxCount\)/);
  assert.match(conductorSource, /dialog\?\.task\.boxInvoiceCodes/);
  assert.match(warehouseSource, /Factura \{pkg\.invoiceCode\}/);
});
