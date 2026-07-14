import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultHoverHex, normalizeHex } from "./ui-surface-color-math.ts";

describe("ui surface color math", () => {
  it("normalizes hex values", () => {
    assert.equal(normalizeHex("2c3440"), "#2c3440");
    assert.equal(normalizeHex("#ABC123"), "#abc123");
    assert.equal(normalizeHex("nope"), null);
  });

  it("mixes toward white for hover on dark bases", () => {
    const hover = defaultHoverHex("#2c3440");
    assert.ok(hover);
    assert.notEqual(hover, "#2c3440");
    assert.match(hover, /^#[0-9a-f]{6}$/);
  });
});
