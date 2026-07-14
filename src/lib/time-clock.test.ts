import assert from "node:assert/strict";
import test from "node:test";
import {
  allowedTimeClockActions,
  buildDailyTimeClockSummaries,
  buildTimeClockAlertCandidates,
  buildTimeClockSummary,
  normalizeEmployeeId,
  payPeriodForDate,
  type TimeClockEvent,
} from "@/lib/time-clock";

function event(
  id: string,
  type: TimeClockEvent["type"],
  occurredAt: string,
): TimeClockEvent {
  return { id, employeeId: "employee-1", type, occurredAt };
}

const settings = {
  timeZone: "UTC",
  weekStartsOn: 0,
  dailyOvertimeAfterHours: 8,
  weeklyOvertimeAfterHours: 40,
  maxDailyHours: 12,
  maxWeeklyHours: 48,
  overtimeAlertHours: 4,
  payPeriodAnchorDate: "2026-07-01",
  payPeriodDays: 14,
  missingClockOutAfterHours: 16,
  incompleteRecordAfterHours: 4,
};

test("time clock accepts only the next operational action", () => {
  assert.deepEqual(allowedTimeClockActions([]), ["clock_in"]);
  assert.deepEqual(
    allowedTimeClockActions([event("1", "clock_in", "2026-07-06T08:00:00.000Z")]),
    ["meal_start", "clock_out"],
  );
  assert.deepEqual(
    allowedTimeClockActions([
      event("1", "clock_in", "2026-07-06T08:00:00.000Z"),
      event("2", "meal_start", "2026-07-06T12:00:00.000Z"),
    ]),
    ["meal_end"],
  );
});

test("time clock subtracts meals and calculates daily overtime", () => {
  const events = [
    event("1", "clock_in", "2026-07-06T08:00:00.000Z"),
    event("2", "meal_start", "2026-07-06T12:00:00.000Z"),
    event("3", "meal_end", "2026-07-06T13:00:00.000Z"),
    event("4", "clock_out", "2026-07-06T18:00:00.000Z"),
  ];
  const [day] = buildDailyTimeClockSummaries(events, settings);

  assert.equal(day.paidMinutes, 540);
  assert.equal(day.regularMinutes, 480);
  assert.equal(day.overtimeMinutes, 60);
});

test("time clock adds weekly overtime without double counting daily overtime", () => {
  const events: TimeClockEvent[] = [];
  for (let index = 0; index < 5; index += 1) {
    const day = String(6 + index).padStart(2, "0");
    events.push(event(`in-${index}`, "clock_in", `2026-07-${day}T08:00:00.000Z`));
    events.push(event(`out-${index}`, "clock_out", `2026-07-${day}T17:00:00.000Z`));
  }

  const summary = buildTimeClockSummary(events, settings, new Date("2026-07-10T18:00:00.000Z"));
  assert.equal(summary.week.paidMinutes, 2_700);
  assert.equal(summary.week.overtimeMinutes, 300);
  assert.equal(summary.week.regularMinutes, 2_400);
});

test("time clock identifies incomplete meals and missed clock outs", () => {
  const onMeal = [
    event("1", "clock_in", "2026-07-06T08:00:00.000Z"),
    event("2", "meal_start", "2026-07-06T12:00:00.000Z"),
  ];
  const candidates = buildTimeClockAlertCandidates({
    employees: [{ id: "employee-1", name: "Ana", employeeId: "EMP-01" }],
    eventsByEmployee: new Map([["employee-1", onMeal]]),
    settings,
    now: new Date("2026-07-06T17:00:00.000Z"),
  });

  assert.equal(candidates[0]?.type, "incomplete_record");

  const openShift = [event("3", "clock_in", "2026-07-06T08:00:00.000Z")];
  const missedOut = buildTimeClockAlertCandidates({
    employees: [{ id: "employee-1", name: "Ana", employeeId: "EMP-01" }],
    eventsByEmployee: new Map([["employee-1", openShift]]),
    settings,
    now: new Date("2026-07-07T01:00:00.000Z"),
  });

  assert.equal(missedOut[0]?.type, "missing_clock_out");
});

test("time clock normalizes employee IDs and aligns pay periods deterministically", () => {
  assert.equal(normalizeEmployeeId(" emp  -  01 "), "EMP-01");
  assert.deepEqual(payPeriodForDate("2026-07-15", settings), {
    start: "2026-07-15",
    end: "2026-07-28",
  });
});
