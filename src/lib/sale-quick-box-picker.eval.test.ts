import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const modalSource = readFileSync(
  join(process.cwd(), "src/components/sale/sale-quick-empty-box-modal.tsx"),
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
    assert.match(modalSource, /Total de cajas/);
    assert.doesNotMatch(modalSource, /Caja vacía \+ depósito|Depósito requerido/);
    assert.match(modalSource, /flex h-10 items-start justify-center/);
    assert.match(modalSource, /min-h-\[8\.25rem\]/);
  });

  it("uses the same paid-deposit decision as a normal sale", () => {
    assert.match(modalSource, /SaleDepositPaidToggle/);
    assert.match(modalSource, /useState\(true\)/);
    assert.match(modalSource, /depositPaid,/);
  });
});
