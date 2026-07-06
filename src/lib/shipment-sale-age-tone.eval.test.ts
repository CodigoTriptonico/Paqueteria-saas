import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const progressSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/shipment-progress-steps.tsx"),
  "utf8",
);

const timingSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "./shipment-timing.ts"),
  "utf8",
);

describe("shipment sale age tone eval", () => {
  it("colors sale age label from elapsed time instead of flat slate", () => {
    assert.equal(progressSource.includes("saleAgeTextClass(timings.saleAgeMs)"), true);
    assert.doesNotMatch(
      progressSource,
      /saleAgeLabel[\s\S]{0,120}text-slate-500/,
    );
  });

  it("defines a progressive palette from fresh to urgent", () => {
    assert.equal(timingSource.includes("export function saleAgeTone"), true);
    assert.equal(timingSource.includes("text-slate-500"), true);
    assert.equal(timingSource.includes("text-slate-300"), true);
    assert.equal(timingSource.includes("text-amber-400"), true);
    assert.equal(timingSource.includes("text-amber-300"), true);
    assert.equal(timingSource.includes("text-sky-300"), false);
    assert.equal(timingSource.includes("text-rose-300"), false);
  });
});
