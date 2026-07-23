import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const ventaSource = readFileSync(new URL("../components/venta-client.tsx", import.meta.url), "utf8");
const stepBarSource = readFileSync(new URL("../components/sale/venta-parts.tsx", import.meta.url), "utf8");

describe("venta mobile flow layout eval", () => {
  it("pins Siguiente under the catalog and keeps a scrollable stepper without clipping step popovers", () => {
    assert.match(
      ventaSource,
      /min-h-0 flex-1 overflow-y-auto pr-1[\s\S]*?flex shrink-0 justify-center border-t border-black\/80 pt-4[\s\S]*?onClick=\{continueFromCart\}/,
    );
    assert.match(
      ventaSource,
      /justify-center overflow-y-auto py-2[\s\S]*?SaleLogisticsStep[\s\S]*?flex shrink-0 justify-center border-t border-black\/80 pt-4[\s\S]*?onClick=\{continueFromLogistics\}/,
    );
    assert.equal(ventaSource.includes("sticky top-0 z-20"), false);
    assert.match(stepBarSource, /hasOpenStepPopover\s*\?\s*"overflow-visible"/);
    assert.match(stepBarSource, /<ol className="flex min-w-max items-start gap-0 lg:min-w-0 lg:w-full">/);
  });
});
