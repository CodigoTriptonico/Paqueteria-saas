import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(new URL("../components/sale/venta-parts.tsx", import.meta.url), "utf8");

describe("sale step contact readability", () => {
  it("gives country and phone a readable mobile treatment", () => {
    assert.match(source, /<span className="hidden sm:contents">\s*<Flag country=\{step\.country\} \/>/);
    assert.match(source, /text-\[11px\] font-black leading-snug sm:text-\[11px\] lg:text-xs/);
    assert.match(
      source,
      /min-h-\[1\.75rem\].*overflow-hidden px-1 text-center leading-tight/,
    );
    assert.match(source, /line-clamp-2 max-w-full break-words/);
  });
});
