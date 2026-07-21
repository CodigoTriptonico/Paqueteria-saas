import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const ventaSource = readFileSync(new URL("../components/venta-client.tsx", import.meta.url), "utf8");
const stepBarSource = readFileSync(new URL("../components/sale/venta-parts.tsx", import.meta.url), "utf8");

describe("venta mobile flow layout", () => {
  it("keeps the step 3 action visible while the mobile catalog moves", () => {
    assert.match(ventaSource, /sticky top-0 z-20 .*sm:static/);
    assert.match(ventaSource, /overflow-visible lg:overflow-hidden/);
    assert.match(ventaSource, /!overflow-visible lg:!overflow-hidden border-t/);
    assert.match(ventaSource, /contentClassName=\{`\$\{flowPanelContentClass\} flex min-h-0 flex-1 flex-col`\}\s*clipContent=\{false\}/);
    assert.ok(
      ventaSource.indexOf("onClick={continueFromCart}") <
        ventaSource.indexOf("min-h-0 flex-1 overflow-y-auto pt-3 pr-1"),
    );
  });

  it("keeps mobile steps scrollable and wide enough to contain contact data", () => {
    assert.match(stepBarSource, /snap-x snap-mandatory overflow-x-auto/);
    assert.match(stepBarSource, /w-\[8\.5rem\] shrink-0 snap-start/);
    assert.match(stepBarSource, /lg:min-w-0 lg:w-auto lg:flex-1/);
  });
});
