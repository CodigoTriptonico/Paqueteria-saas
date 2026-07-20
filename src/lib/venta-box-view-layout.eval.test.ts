import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ventaSource = readFileSync(join(root, "src/components/venta-client.tsx"), "utf8");
const boxPickerSource = readFileSync(join(root, "src/components/sale/sale-box-picker.tsx"), "utf8");
const surfaceContextSource = readFileSync(join(root, "src/lib/ui-surface-context.ts"), "utf8");

describe("venta box view layout eval", () => {
  it("uses sale.box context on the box step", () => {
    assert.equal(ventaSource.includes('activeStep === "box"'), true);
    assert.equal(ventaSource.includes('"sale.box"'), true);
    assert.equal(surfaceContextSource.includes('"sale.box"'), true);
  });

  it("renders box catalog in rows and cards from the sidebar layout toggle", () => {
    assert.equal(ventaSource.includes("<SaleBoxPicker"), true);
    assert.equal(ventaSource.includes("viewLayout={viewLayout}"), true);
    assert.equal(boxPickerSource.includes('viewLayout === "rows"'), true);
    assert.equal(boxPickerSource.includes("SaleBoxRow"), true);
    assert.equal(boxPickerSource.includes("SaleBoxCard"), true);
    assert.equal(boxPickerSource.includes("items-start"), true);
    assert.equal(boxPickerSource.includes("min-h-[12rem]"), false);
  });
});
