import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/shipment-step-detail-panel.tsx"),
  "utf8",
);

describe("shipment step detail UI eval", () => {
  it("does not show the internal channel field in the detail panel", () => {
    assert.equal(source.includes(">Canal<"), false);
    assert.equal(source.includes('step.channelLabel || "General"'), false);
  });

  it("does not repeat status already implied by the selected step", () => {
    assert.equal(source.includes(">Estado<"), false);
    assert.equal(source.includes('return "Actual";'), false);
    assert.equal(source.includes("stateLabel("), false);
    assert.equal(source.includes("stateClass("), false);
  });

  it("does not show empty actor placeholders in the step summary", () => {
    assert.equal(source.includes(">Por<"), false);
    assert.equal(source.includes('stepActor || "Sin registro"'), false);
  });

  it("formats step history with readable titles and relative timestamps", () => {
    assert.equal(source.includes("buildStepSummarySentence"), true);
    assert.equal(source.includes("supplementaryStepHistory"), true);
    assert.equal(source.includes(">Historial<"), false);
  });
});
