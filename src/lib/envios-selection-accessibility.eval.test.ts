import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const source = readFileSync(join(process.cwd(), "src/components/envios-client.tsx"), "utf8");

describe("envios selection accessibility eval", () => {
  it("exposes selectable shipment cards with supported checkbox semantics", () => {
    assert.match(source, /role=\{selectionEnabled \? "checkbox" : undefined\}/);
    assert.match(source, /aria-checked=\{selectionEnabled \? isSelected : undefined\}/);
    assert.doesNotMatch(source, /aria-selected=\{isSelected\}/);
  });
});
