import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const modalSource = readFileSync(
  join(process.cwd(), "src/components/sale/sale-quick-empty-box-modal.tsx"),
  "utf8",
);
const fieldSource = readFileSync(
  join(process.cwd(), "src/components/sale/sale-payment-method-field.tsx"),
  "utf8",
);

describe("quick-sale product-picker visual contract", () => {
  it("uses the same product hierarchy as the normal sales picker", () => {
    assert.match(modalSource, /<Package className="h-5 w-5"/);
    assert.match(modalSource, /\{box\[0\]\}/);
    assert.match(modalSource, /\{box\[4\] \|\| "Caja vacía"\}/);
    assert.match(modalSource, />\s*Cobra\s*</);
    assert.match(modalSource, /\{box\[1\]\}/);
  });

  it("keeps selection obvious and the grid usable on narrow screens", () => {
    assert.match(modalSource, /grid grid-cols-2 gap-2 sm:grid-cols-3/);
    assert.match(modalSource, /border-emerald-400 bg-emerald-400\/10/);
    assert.match(modalSource, /SaleBoxCartQtyBadge/);
    assert.match(modalSource, /Clic agrega · clic derecho resta/);
    assert.match(modalSource, /aria-label=\{`\$\{box\[0\]\}, \$\{box\[1\]\}/);
  });

  it("does not confuse the box total with the deposit or shift when quantity appears", () => {
    assert.match(modalSource, /Venta de caja vacía/);
    assert.match(fieldSource, /Total de cajas/);
    assert.match(fieldSource, /Queda debiendo/);
    assert.doesNotMatch(modalSource, /Caja vacía \+ depósito|Depósito requerido/);
    assert.match(modalSource, /flex h-10 items-start justify-center/);
    assert.match(fieldSource, /min-h-4/);
  });

  it("lets the seller edit the deposit or choose full payment before checkout", () => {
    assert.match(modalSource, /SaleDepositChargeField/);
    assert.match(modalSource, /paymentMode/);
    assert.match(modalSource, /payNowAmount/);
    assert.match(modalSource, /useState\(true\)/);
    assert.match(modalSource, /depositPaid,/);
    assert.match(fieldSource, /Pago completo/);
    assert.match(fieldSource, /Monto del depósito|aria-label="Monto del depósito"/);
    assert.match(fieldSource, /export function SaleDepositChargeField/);
    assert.match(fieldSource, /\$\{quotedLabel\} − \$\{chargeLabel\}/);
  });
});
