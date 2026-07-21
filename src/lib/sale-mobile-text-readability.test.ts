import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const stepBarSource = readFileSync(new URL("../components/sale/venta-parts.tsx", import.meta.url), "utf8");
const boxPickerSource = readFileSync(new URL("../components/sale/sale-box-picker.tsx", import.meta.url), "utf8");

describe("venta mobile text readability", () => {
  it("bounds each step value inside its own mobile tile", () => {
    assert.match(stepBarSource, /w-full min-w-0 max-w-full truncate text-center leading-snug/);
    assert.match(stepBarSource, /line-clamp-2 max-w-full break-words/);
  });

  it("keeps a product row to name, timing, price, and quantity", () => {
    assert.match(boxPickerSource, /grid-cols-\[2rem_minmax\(0,1fr\)_auto\]/);
    assert.match(boxPickerSource, /min-w-\[4\.5rem\] flex-col items-end/);
    assert.doesNotMatch(boxPickerSource, /minmax\(0,6rem\)_minmax\(0,5\.5rem\)_auto/);
  });
});
