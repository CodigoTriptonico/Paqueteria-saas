import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "shipment-display.ts"),
  "utf8",
);

describe("shipment office channel eval", () => {
  it("uses office as the channel with simple office copy", () => {
    assert.equal(source.includes('detail: "Entregado en oficina"'), true);
    assert.equal(source.includes('...stepMeta("empty_box", "office", "Oficina")'), true);
    assert.equal(source.includes("Entregada en mostrador"), false);
    assert.equal(source.includes('...stepMeta("empty_box", "office", handingNow ? "Mostrador" : "Oficina")'), false);
  });
});
