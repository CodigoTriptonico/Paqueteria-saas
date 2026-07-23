import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const ventaSource = readFileSync(new URL("../components/venta-client.tsx", import.meta.url), "utf8");
const stepBarSource = readFileSync(new URL("../components/sale/venta-parts.tsx", import.meta.url), "utf8");

function sliceAround(source: string, marker: string, before = 500) {
  const index = source.indexOf(marker);
  assert.ok(index >= 0, `missing marker: ${marker}`);
  return source.slice(Math.max(0, index - before), index);
}

describe("venta mobile flow layout", () => {
  it("keeps the step 3 action pinned below the scrollable catalog", () => {
    assert.match(ventaSource, /overflow-visible lg:overflow-hidden/);
    assert.match(ventaSource, /!overflow-visible lg:!overflow-hidden border-t/);
    assert.match(ventaSource, /contentClassName=\{`\$\{flowPanelContentClass\} flex min-h-0 flex-1 flex-col`\}\s*clipContent=\{false\}/);
    assert.ok(
      ventaSource.indexOf("min-h-0 flex-1 overflow-y-auto pr-1") <
        ventaSource.indexOf("onClick={continueFromCart}"),
    );
    assert.match(
      sliceAround(ventaSource, "onClick={continueFromCart}"),
      /flex shrink-0 justify-center border-t border-black\/80 pt-4/,
    );
  });

  it("pins logistics Siguiente at the bottom and centers the movement cards", () => {
    assert.match(
      ventaSource,
      /justify-center overflow-y-auto py-2[\s\S]*?SaleLogisticsStep[\s\S]*?flex shrink-0 justify-center border-t border-black\/80 pt-4[\s\S]*?onClick=\{continueFromLogistics\}/,
    );
    assert.match(
      ventaSource,
      /activeStep === "box" \|\|\s*activeStep === "delivery"/,
    );
  });

  it("keeps mobile steps scrollable and wide enough to contain contact data", () => {
    assert.match(stepBarSource, /snap-x snap-mandatory overflow-x-auto/);
    assert.match(stepBarSource, /w-\[8\.5rem\] shrink-0 snap-start/);
    assert.match(stepBarSource, /lg:min-w-0 lg:w-auto lg:flex-1/);
  });
});
