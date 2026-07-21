import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveScheduleConfirmDriverId } from "./logistics-schedule-confirm-driver.ts";

describe("resolveScheduleConfirmDriverId", () => {
  const conductors = [
    { id: "c1", roleSlug: "conductor" },
    { id: "c2", roleSlug: "conductor" },
  ];

  it("uses the selected driver when the picker is shown", () => {
    assert.equal(
      resolveScheduleConfirmDriverId({
        showDriverPicker: true,
        selectedDriverId: "picked",
        defaultDriverId: "default",
        conductors,
      }),
      "picked",
    );
  });

  it("prefers the weekday default when sellers hide the picker", () => {
    assert.equal(
      resolveScheduleConfirmDriverId({
        showDriverPicker: false,
        selectedDriverId: "",
        defaultDriverId: "default",
        conductors,
      }),
      "default",
    );
  });

  it("leaves driver empty when sellers hide the picker and there is no weekday default", () => {
    assert.equal(
      resolveScheduleConfirmDriverId({
        showDriverPicker: false,
        selectedDriverId: "",
        defaultDriverId: null,
        conductors,
      }),
      "",
    );
  });

  it("returns empty when no driver can be resolved", () => {
    assert.equal(
      resolveScheduleConfirmDriverId({
        showDriverPicker: false,
        selectedDriverId: "",
        defaultDriverId: null,
        conductors: [{ id: "x", roleSlug: "admin" }],
      }),
      "",
    );
  });
});
