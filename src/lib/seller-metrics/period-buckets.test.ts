import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  anchorDateKey,
  dayKeyFromDate,
  listDayKeysInPeriod,
  normalizeAnchorDate,
  periodBounds,
  periodLabel,
  shiftAnchor,
} from "@/lib/seller-metrics/period-buckets";

function localDate(year: number, month: number, day: number) {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

describe("seller metrics period buckets", () => {
  it("bounds a day from midnight to next midnight", () => {
    const anchor = localDate(2026, 7, 15);
    const { start, end } = periodBounds(anchor, "day");

    assert.equal(start.getHours(), 0);
    assert.equal(end.getTime() - start.getTime(), 24 * 60 * 60 * 1000);
    assert.equal(dayKeyFromDate(start), "2026-07-15");
  });

  it("bounds a week from Monday through Sunday", () => {
    const anchor = localDate(2026, 7, 15);
    const { start, end } = periodBounds(anchor, "week");

    assert.equal(start.getDay(), 1);
    assert.equal(dayKeyFromDate(start), "2026-07-13");
    assert.equal(dayKeyFromDate(end), "2026-07-20");
    assert.equal(listDayKeysInPeriod(start, end).length, 7);
  });

  it("bounds a month on calendar boundaries", () => {
    const anchor = localDate(2026, 7, 15);
    const { start, end } = periodBounds(anchor, "month");

    assert.equal(dayKeyFromDate(start), "2026-07-01");
    assert.equal(dayKeyFromDate(end), "2026-08-01");
    assert.equal(listDayKeysInPeriod(start, end).length, 31);
  });

  it("shifts anchors by day, week, and month", () => {
    const anchor = localDate(2026, 7, 15);

    assert.equal(anchorDateKey(shiftAnchor(anchor, "day", -1)), "2026-07-14");
    assert.equal(anchorDateKey(shiftAnchor(anchor, "week", 1)), "2026-07-22");
    assert.equal(anchorDateKey(shiftAnchor(anchor, "month", -1)), "2026-06-15");
  });

  it("formats readable period labels", () => {
    const anchor = normalizeAnchorDate(localDate(2026, 7, 15));

    assert.match(periodLabel(anchor, "day"), /15/);
    assert.match(periodLabel(anchor, "week"), /13/);
    assert.match(periodLabel(anchor, "week"), /19/);
    assert.match(periodLabel(anchor, "month"), /julio/i);
  });

  it("bounds and labels a custom date range inclusively", () => {
    const { start, end } = periodBounds(localDate(2026, 7, 15), "range", {
      from: "2026-07-10",
      to: "2026-07-12",
    });

    assert.equal(dayKeyFromDate(start), "2026-07-10");
    assert.equal(dayKeyFromDate(end), "2026-07-13");
    assert.equal(listDayKeysInPeriod(start, end).length, 3);
    assert.match(
      periodLabel(localDate(2026, 7, 15), "range", { from: "2026-07-10", to: "2026-07-12" }),
      /10/,
    );
    assert.match(
      periodLabel(localDate(2026, 7, 15), "range", { from: "2026-07-10", to: "2026-07-12" }),
      /12/,
    );
  });

  it("normalizes inverted custom ranges", () => {
    const { start, end } = periodBounds(localDate(2026, 7, 15), "range", {
      from: "2026-07-20",
      to: "2026-07-10",
    });

    assert.equal(dayKeyFromDate(start), "2026-07-10");
    assert.equal(dayKeyFromDate(end), "2026-07-21");
  });
});
