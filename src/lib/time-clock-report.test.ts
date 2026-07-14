import assert from "node:assert/strict";
import test from "node:test";
import { buildTimeClockReportCsv } from "@/lib/time-clock-report";

test("time clock report serializes employee hours as portable CSV", () => {
  const csv = buildTimeClockReportCsv([
    {
      employeeId: "EMP-01",
      employeeName: "Ana, López",
      date: "2026-07-13",
      regularHours: 8,
      overtimeHours: 1.5,
      totalHours: 9.5,
    },
  ]);

  assert.match(csv, /"Ana, López"/);
  assert.match(csv, /8\.00,1\.50,9\.50/);
});
