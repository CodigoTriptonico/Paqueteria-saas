import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const ventaSource = readFileSync(new URL("../components/venta-client.tsx", import.meta.url), "utf8");
const stepBarSource = readFileSync(new URL("../components/sale/venta-parts.tsx", import.meta.url), "utf8");

describe("venta mobile flow layout eval", () => {
  it("uses a real mobile action bar and a scrollable stepper without clipping step popovers", () => {
    assert.match(ventaSource, /sticky top-0 z-20 .*backdrop-blur sm:static/);
    assert.match(stepBarSource, /hasOpenStepPopover\s*\?\s*"overflow-visible"/);
    assert.match(stepBarSource, /<ol className="flex min-w-max items-start gap-0 sm:min-w-0 sm:w-full">/);
  });
});
