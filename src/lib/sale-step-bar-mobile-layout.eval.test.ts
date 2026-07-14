import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(new URL("../components/sale/venta-parts.tsx", import.meta.url), "utf8");

describe("sale step bar mobile layout", () => {
  it("keeps each step number inside its narrow tile and uses a compact label", () => {
    assert.match(source, /flex-col items-center justify-center gap-0\.5 sm:min-h-\[2rem\] sm:flex-row/);
    assert.match(source, /<span className="sm:hidden">\{step\.compactLabel\}<\/span>/);
    assert.match(source, /<span className="hidden sm:inline">\{step\.label\}<\/span>/);
  });
});
