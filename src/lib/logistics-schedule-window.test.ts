import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  logisticsRequestedRouteDayPatch,
  logisticsScheduleWindowPatch,
} from "@/lib/logistics-schedule-window";

describe("logistics schedule window", () => {
  it("keeps a pending route day without inventing an appointment time", () => {
    const patch = logisticsRequestedRouteDayPatch("2026-07-27");

    assert.equal(patch.scheduled_at, null);
    assert.equal(patch.schedule_kind, null);
    assert.equal(patch.window_start_at, null);
    assert.equal(patch.schedule_confirmation_status, "pending");
    assert.equal(patch.requested_schedule_at?.slice(0, 10), "2026-07-27");
  });

  it("clears the request when the route day is invalid", () => {
    assert.deepEqual(logisticsRequestedRouteDayPatch("lunes"), logisticsScheduleWindowPatch(null));
  });
});
