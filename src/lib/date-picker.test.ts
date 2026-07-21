import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCalendarMonth,
  formatDateInputDisplay,
  formatDateTimeInputValue,
  isDateDisabled,
  joinDateTimeInput,
  parseDateInput,
  resolveCalendarView,
  shiftCalendarMonth,
  splitDateTimeInput,
} from "./date-picker.ts";

describe("date picker", () => {
  it("parses and formats schedule dates", () => {
    assert.deepEqual(parseDateInput("2026-07-10"), { year: 2026, month: 7, day: 10 });
    assert.equal(formatDateInputDisplay("2026-07-10"), "10/07/2026");
    assert.equal(parseDateInput("invalid"), null);
  });

  it("builds a monday-first month grid", () => {
    const july2026 = buildCalendarMonth(2026, 7);

    assert.equal(july2026.length, 42);
    assert.equal(july2026[2].date, "2026-07-01");
    assert.equal(july2026[2].inMonth, true);
    assert.equal(july2026[0].inMonth, false);
  });

  it("shifts months across year boundaries", () => {
    assert.deepEqual(shiftCalendarMonth(2026, 1, -1), { year: 2025, month: 12 });
    assert.deepEqual(shiftCalendarMonth(2026, 12, 1), { year: 2027, month: 1 });
  });

  it("respects min and max boundaries", () => {
    assert.equal(isDateDisabled("2026-07-09", "2026-07-10"), true);
    assert.equal(isDateDisabled("2026-07-10", "2026-07-10"), false);
    assert.equal(isDateDisabled("2026-07-11", undefined, "2026-07-10"), true);
  });

  it("can restrict selectable days to a logistics weekday", () => {
    // 2026-07-13 is Monday (0), 2026-07-14 is Tuesday
    assert.equal(isDateDisabled("2026-07-13", undefined, undefined, { allowedWeekdays: [0] }), false);
    assert.equal(isDateDisabled("2026-07-14", undefined, undefined, { allowedWeekdays: [0] }), true);
  });

  it("resolves the visible month from the selected value", () => {
    assert.deepEqual(resolveCalendarView("2026-03-15"), { year: 2026, month: 3 });
    assert.deepEqual(resolveCalendarView("", new Date("2026-07-10T12:00:00")), {
      year: 2026,
      month: 7,
    });
  });

  it("splits and joins datetime-local values", () => {
    assert.deepEqual(splitDateTimeInput("2026-07-10T17:00"), {
      date: "2026-07-10",
      time: "17:00",
    });
    assert.equal(joinDateTimeInput("2026-07-10", "17:00"), "2026-07-10T17:00");
    assert.equal(joinDateTimeInput("2026-07-10", ""), "2026-07-10T09:00");
    assert.equal(joinDateTimeInput("", "17:00"), "");
    assert.equal(formatDateTimeInputValue(new Date("2026-07-10T17:00:00")), "2026-07-10T17:00");
  });
});
