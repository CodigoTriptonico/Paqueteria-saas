import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const stepBarSource = readFileSync(new URL("../components/sale/venta-parts.tsx", import.meta.url), "utf8");
const boxPickerSource = readFileSync(new URL("../components/sale/sale-box-picker.tsx", import.meta.url), "utf8");

describe("venta mobile text readability eval", () => {
  it("preserves the desktop stepper while mobile tiles scroll instead of squeezing text", () => {
    assert.match(stepBarSource, /min-w-max items-start gap-0 lg:min-w-0 lg:w-full/);
    assert.match(stepBarSource, /w-\[8\.5rem\] shrink-0 snap-start flex-col lg:min-w-0 lg:w-auto lg:flex-1/);
  });

  it("uses the product title as the flexible mobile row field", () => {
    assert.match(boxPickerSource, /<div className="min-w-0">\s*<p className="truncate text-sm font-black/);
    assert.match(boxPickerSource, /<p className="whitespace-nowrap text-sm font-black text-slate-200">\{box\[1\]\}<\/p>/);
  });
});
