import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyScheduleChangesCommittedDate,
  applyScheduleDateChangeCopy,
  calendarDaysBetween,
  markReadyConflictsWithScheduledDate,
  markReadyScheduleConflictCopy,
  relativeScheduleDayLabel,
} from "@/lib/shipment-schedule-confirm";

describe("shipment-schedule-confirm", () => {
  const reference = new Date("2026-07-05T15:00:00");

  it("counts calendar days between schedule dates", () => {
    assert.equal(calendarDaysBetween("2026-07-05", "2026-07-08"), 3);
    assert.equal(relativeScheduleDayLabel(3), "dentro de 3 días");
    assert.equal(relativeScheduleDayLabel(1), "mañana");
  });

  it("detects mark-ready conflict with a future scheduled date", () => {
    assert.equal(
      markReadyConflictsWithScheduledDate("scheduled", "2026-07-08T10:00:00", reference),
      true,
    );
    assert.equal(
      markReadyConflictsWithScheduledDate("scheduled", "2026-07-05T10:00:00", reference),
      false,
    );
    assert.equal(markReadyConflictsWithScheduledDate("pending", "", reference), false);
  });

  it("detects committed schedule day changes", () => {
    assert.equal(
      applyScheduleChangesCommittedDate("2026-07-08T10:00:00", "2026-07-05T10:00:00"),
      true,
    );
    assert.equal(
      applyScheduleChangesCommittedDate("2026-07-08T10:00:00", "2026-07-08T14:00:00"),
      false,
    );
  });

  it("builds readable confirmation copy", () => {
    const copy = markReadyScheduleConflictCopy("Recoger", "2026-07-08T10:00:00", reference);
    assert.match(copy.title, /recoger/i);
    assert.match(copy.message, /dentro de 3 días/i);
    assert.match(copy.message, /programada/i);

    const changeCopy = applyScheduleDateChangeCopy(
      "Dejar",
      "2026-07-08T10:00:00",
      "2026-07-05T10:00:00",
      reference,
    );
    assert.match(changeCopy.title, /fecha/i);
    assert.match(changeCopy.message, /Tenía programada/i);
  });
});
