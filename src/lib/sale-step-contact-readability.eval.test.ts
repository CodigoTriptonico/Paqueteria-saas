import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(new URL("../components/sale/venta-parts.tsx", import.meta.url), "utf8");

describe("sale step contact readability eval", () => {
  it("does not dim completed phone numbers or crowd mobile country names with flags", () => {
    assert.match(source, /step\.isActive\s*\? "text-\[11px\] font-black tracking-tight text-emerald-100"\s*:\s*"text-\[11px\] font-black tracking-tight text-slate-200"/);
    assert.match(source, /step\.country \? \(\s*<span className="hidden sm:contents">/);
  });
});
