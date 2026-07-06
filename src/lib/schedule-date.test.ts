import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  minScheduleDateInput,
  minScheduleDatetimeInput,
  resolveScheduleDate,
  resolveScheduleDatetime,
} from "@/lib/schedule-date";

const reference = new Date(2026, 6, 4, 20, 25, 0);

describe("schedule date helpers", () => {
  it("uses today as the minimum schedule date", () => {
    assert.equal(minScheduleDateInput(reference), "2026-07-04");
    assert.equal(minScheduleDatetimeInput(reference), "2026-07-04T00:00");
  });

  it("clamps past schedule dates to today", () => {
    assert.equal(resolveScheduleDate("2026-07-03", reference), "2026-07-04");
    assert.equal(resolveScheduleDate("2026-07-04", reference), "2026-07-04");
    assert.equal(resolveScheduleDate(undefined, reference), "2026-07-04");
  });

  it("clamps past schedule datetimes to start of today", () => {
    assert.equal(resolveScheduleDatetime("2026-07-03T18:00", reference), "2026-07-04T00:00");
    assert.equal(resolveScheduleDatetime("2026-07-04T08:25", reference), "2026-07-04T08:25");
    assert.equal(resolveScheduleDatetime(undefined, reference), "2026-07-04T00:00");
  });
});

describe("schedule date picker eval", () => {
  it("blocks past days on scheduling pickers", () => {
    const shipmentMenuSource = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../components/shipment-step-context-menu.tsx"),
      "utf8",
    );
    const saleSource = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../components/sale/sale-logistics-step.tsx",
      ),
      "utf8",
    );

    assert.match(shipmentMenuSource, /DateInput[\s\S]*?min=\{minScheduleDateInput\(\)\}/);
    assert.match(shipmentMenuSource, /resolveScheduleDate\(routeDate\)/);
    assert.match(shipmentMenuSource, /resolveScheduleDate\(nextValue\)/);
    assert.match(saleSource, /DateInput[\s\S]*?min=\{minScheduleDateInput\(\)\}/);
    assert.match(saleSource, /resolveScheduleDate\(nextValue\)/);
  });
});
