import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const invoiceSource = readFileSync(
  join(process.cwd(), "src/components/sale/venta-parts.tsx"),
  "utf8",
);

describe("sale invoice ETA hierarchy", () => {
  it("keeps ETA beside recipient context instead of in a standalone strip", () => {
    assert.match(invoiceSource, /country\?: string;\s+eta\?: string;/);
    assert.match(invoiceSource, /country=\{recipient\.country\.trim\(\) \|\| undefined\}\s+eta=\{deliveryEta\}/);
    assert.match(invoiceSource, /saleInvoiceEtaLabel\(eta\)/);
    assert.doesNotMatch(invoiceSource, /Entrega estimada ·/);
    assert.doesNotMatch(invoiceSource, /mb-4 flex flex-wrap gap-2 border-b/);
  });
});
