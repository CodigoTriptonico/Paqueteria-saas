import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getLogisticsWeekdayIndex,
  nextDateForLogisticsWeekday,
  dateMatchesLogisticsWeekday,
  resolveRouteDateForTemplate,
  resolveRouteDateForWeekday,
  startOfLogisticsWeek,
} from "@/lib/logistics-route-week";

describe("logistics-route-week", () => {
  it("maps Monday-based weekday index", () => {
    assert.equal(getLogisticsWeekdayIndex("2026-07-06"), 0);
    assert.equal(getLogisticsWeekdayIndex("2026-07-11"), 5);
    assert.equal(getLogisticsWeekdayIndex("2026-07-12"), 6);
  });

  it("resolves route date from week start and weekday", () => {
    const weekStart = startOfLogisticsWeek(new Date("2026-07-11T12:00:00"));
    assert.equal(resolveRouteDateForWeekday(0, weekStart), "2026-07-06");
    assert.equal(resolveRouteDateForWeekday(5, weekStart), "2026-07-11");
    assert.equal(resolveRouteDateForWeekday(6, weekStart), "2026-07-12");
  });

  it("resolves route date from task anchor and template weekday", () => {
    assert.equal(resolveRouteDateForTemplate("2026-07-11", 0), "2026-07-06");
    assert.equal(resolveRouteDateForTemplate("2026-07-06", 5), "2026-07-11");
  });

  it("picks the next matching weekday including today", () => {
    assert.equal(nextDateForLogisticsWeekday(0, "2026-07-06"), "2026-07-06");
    assert.equal(nextDateForLogisticsWeekday(0, "2026-07-07"), "2026-07-13");
    assert.equal(nextDateForLogisticsWeekday(6, "2026-07-10"), "2026-07-12");
    assert.equal(dateMatchesLogisticsWeekday("2026-07-13", 0), true);
    assert.equal(dateMatchesLogisticsWeekday("2026-07-14", 0), false);
  });
});
