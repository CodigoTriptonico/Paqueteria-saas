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

describe("quick-sale box picker", () => {
  it("shows every box as a direct product choice instead of a native select", () => {
    assert.match(modalSource, /<fieldset className="grid gap-2">/);
    assert.match(modalSource, /boxes\.map\(\(box\) =>/);
    assert.match(modalSource, /role="group"/);
    assert.match(modalSource, /aria-pressed=\{selected\}/);
    assert.match(modalSource, /onClick=\{\(\) => updateBoxSelection\(box\[0\], "add"\)\}/);
    assert.match(modalSource, /onContextMenu=\{\(event\) =>/);
    assert.doesNotMatch(modalSource, /<select/);
  });

  it("starts empty and derives the selected box only after a click", () => {
    assert.match(modalSource, /useState\(0\)/);
    assert.match(modalSource, /boxes\.find\(\(box\) => box\[0\] === selectedBoxKey\) \|\| null/);
    assert.doesNotMatch(modalSource, /boxes\[0\]\?\.\[0\]/);
  });

  it("uses the shared sales quantity badge and removes the separate quantity field", () => {
    assert.match(modalSource, /<SaleBoxCartQtyBadge quantity=\{boxCount\} \/>/);
    assert.match(modalSource, /className="flex h-10 items-start justify-center"/);
    assert.doesNotMatch(modalSource, />Cantidad</);
    assert.doesNotMatch(modalSource, /aria-label="Cantidad de cajas"/);
  });

  it("labels the product subtotal correctly and joins it with the deposit math", () => {
    assert.match(modalSource, /SaleDepositChargeField/);
    assert.match(modalSource, /boxDetail=\{selectedBox \? `\$\{selectedBox\[1\]\} x \$\{boxCount\}` : ""\}/);
    assert.match(fieldSource, /Total de cajas/);
    assert.match(fieldSource, /Queda debiendo/);
    assert.match(fieldSource, /aria-live="polite"/);
    assert.doesNotMatch(modalSource, /Depósito requerido/);
  });

  it("asks how the empty box is delivered in seller language", () => {
    assert.match(modalSource, /¿Cómo se entrega la caja vacía\?/);
    assert.match(modalSource, /Entregar ahora/);
    assert.match(modalSource, /Entregarla en mostrador/);
    assert.match(modalSource, /Programar ruta/);
    assert.doesNotMatch(modalSource, /Recoge en oficina|Programar entrega<\/p>/);
  });
});
