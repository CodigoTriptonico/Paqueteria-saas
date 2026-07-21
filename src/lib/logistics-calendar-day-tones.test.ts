import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildLogisticsCalendarDayTones,
  logisticsCalendarDayToneClass,
  logisticsCalendarDayToneLegend,
  mergeLogisticsCalendarDayTone,
  resolveLogisticsTaskCalendarTone,
} from "./logistics-calendar-day-tones.ts";

describe("logistics-calendar-day-tones", () => {
  it("maps task status to calendar tones", () => {
    assert.equal(resolveLogisticsTaskCalendarTone({ status: "pending" }), "pending");
    assert.equal(resolveLogisticsTaskCalendarTone({ status: "scheduled" }), "ready");
    assert.equal(
      resolveLogisticsTaskCalendarTone({ status: "scheduled", assignedTo: "d1" }),
      "assigned",
    );
    assert.equal(resolveLogisticsTaskCalendarTone({ status: "assigned" }), "assigned");
    assert.equal(resolveLogisticsTaskCalendarTone({ status: "loaded_to_truck" }), "assigned");
    assert.equal(resolveLogisticsTaskCalendarTone({ status: "cancelled" }), "attention");
    assert.equal(resolveLogisticsTaskCalendarTone({ status: "completed" }), null);
  });

  it("keeps the strongest tone when merging a day", () => {
    assert.equal(mergeLogisticsCalendarDayTone("ready", "pending"), "pending");
    assert.equal(mergeLogisticsCalendarDayTone("pending", "attention"), "attention");
    assert.equal(mergeLogisticsCalendarDayTone("attention", "assigned"), "attention");
  });

  it("builds a date→tone map from scheduled tasks", () => {
    const tones = buildLogisticsCalendarDayTones([
      { scheduledAt: "2026-07-24T17:00:00.000Z", status: "scheduled" },
      { scheduledAt: "2026-07-24T18:00:00.000Z", status: "pending" },
      { scheduledAt: "2026-07-25T17:00:00.000Z", status: "assigned", assignedTo: "d1" },
      { scheduledAt: "2026-07-25T17:00:00.000Z", status: "completed" },
      { scheduledAt: null, status: "pending" },
    ]);

    assert.equal(tones["2026-07-24"], "pending");
    assert.equal(tones["2026-07-25"], "assigned");
    assert.equal(Object.keys(tones).length, 2);
  });

  it("exposes legend labels and tone classes for the calendar UI", () => {
    assert.deepEqual(
      logisticsCalendarDayToneLegend.map((entry) => entry.label),
      ["Pendiente", "Listo", "Asignado", "Atención"],
    );
    assert.match(logisticsCalendarDayToneClass("pending"), /amber/);
    assert.match(logisticsCalendarDayToneClass("ready"), /sky/);
    assert.match(logisticsCalendarDayToneClass("assigned"), /emerald/);
    assert.match(logisticsCalendarDayToneClass("attention"), /rose/);
  });
});
