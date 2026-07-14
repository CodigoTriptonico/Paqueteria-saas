import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/shipment-progress-steps.tsx"),
  "utf8",
);

describe("shipment compact progress UI eval", () => {
  it("shows readable step names and current state instead of number-only bars", () => {
    assert.equal(source.includes("function compactStepName"), true);
    assert.equal(source.includes("compactStepName(step.kind)"), true);
    assert.equal(source.includes("return EMPTY_BOX_LEG_LABELS.short;"), true);
    assert.equal(source.includes("return FULL_BOX_LEG_LABELS.short;"), true);
    assert.equal(source.includes("shipment-step-active-pulse"), true);
    assert.equal(source.includes("grid h-12"), false);
  });

  it("opens pickup actions when clicking active Recoger step", () => {
    assert.equal(source.includes("function shouldOpenLegMenuOnClick"), true);
    assert.equal(source.includes("openStepMenuFromButton(step, step.id, event)"), true);
    assert.doesNotMatch(source, /Clic en Recoger para programar o marcar recolección/);
    assert.match(source, /step\.kind === "empty_box" \|\| step\.kind === "full_box"/);
  });

  it("blocks interaction on future pending steps", () => {
    assert.equal(source.includes("export function stepIsReachable"), true);
    assert.match(source, /stepIsReachable\(step\)/);
    assert.match(source, /disabled=\{!stepIsInteractive\(step\)\}/);
  });

  it("keeps active-step pulse local to the step button", () => {
    const cssSource = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../app/globals.css"),
      "utf8",
    );
    assert.equal(source.includes("[contain:paint]"), true);
    assert.equal(source.includes("transition-colors"), true);
    assert.equal(cssSource.includes("contain: paint"), true);
    const pulseStart = cssSource.indexOf("@keyframes shipment-step-active-pulse");
    const pulseEnd = cssSource.indexOf(".shipment-step-active-pulse", pulseStart);
    assert.ok(pulseStart >= 0 && pulseEnd > pulseStart);
    assert.equal(cssSource.slice(pulseStart, pulseEnd).includes("0 0 16px"), false);
  });

  it("does not show the last completed gap summary row", () => {
    assert.equal(source.includes("Último tramo:"), false);
    assert.equal(source.includes("lastCompletedGap"), false);
  });

  it("supports a single-line compact row for envios", () => {
    assert.equal(source.includes("singleLine?: boolean"), true);
    assert.match(source, /if \(singleLine\) \{[\s\S]*?gridTemplateColumns: `repeat\(\$\{steps\.length\}, minmax\(0, 1fr\)\)`/);
    assert.equal(source.includes("w-full max-w-full"), true);
    assert.equal(source.includes("w-fit max-w-full"), false);
    assert.equal(source.includes("text-[11px] font-black leading-none"), true);
    assert.equal(source.includes("h-9 w-full min-w-0 items-center gap-1"), true);
    assert.equal(source.includes("Paso {focusIndex || steps.length} de {steps.length}"), true);
  });
});
