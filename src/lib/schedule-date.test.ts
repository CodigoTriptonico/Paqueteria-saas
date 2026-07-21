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
  scheduledAtToLocalDateInput,
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

  it("derives the local calendar date from stored schedule timestamps", () => {
    const originalTz = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";

    try {
      assert.equal(
        scheduledAtToLocalDateInput("2026-07-12T03:00:00.000Z"),
        "2026-07-11",
      );
      assert.equal(
        scheduledAtToLocalDateInput("2026-07-12T17:00:00.000Z"),
        "2026-07-12",
      );
      assert.equal(scheduledAtToLocalDateInput(null), "");
    } finally {
      if (originalTz === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = originalTz;
      }
    }
  });
});

describe("schedule date picker eval", () => {
  it("blocks past days on scheduling pickers", () => {
    const schedulePanelSource = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../components/logistica/logistics-task-schedule-confirm-panel.tsx",
      ),
      "utf8",
    );

    assert.match(schedulePanelSource, /DateInput[\s\S]*?min=\{minScheduleDateInput\(\)\}/);
    assert.match(schedulePanelSource, /selectDate/);
  });
});
