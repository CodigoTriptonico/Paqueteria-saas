import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  applyScheduleTimePreset,
  formatScheduleAtDisplay,
  formatScheduleDateLabel,
  formatScheduleTimePart,
  parseScheduleTime,
  scheduleTimePresetMatches,
} from "@/lib/sale/schedule-time";

describe("schedule time display", () => {
  it("starts without a default exact time", () => {
    assert.deepEqual(parseScheduleTime(""), { kind: "exact", start: "" });
  });

  it("shows Spanish month names for scheduled dates", () => {
    assert.equal(formatScheduleDateLabel("2026-07-10"), "10 de julio de 2026");
  });

  it("shows scheduled date and time with month name", () => {
    assert.equal(
      formatScheduleAtDisplay("2026-07-10T17:00:00.000Z"),
      "10 de julio de 2026 a las 5:00 PM",
    );
  });

  it("keeps desde mode when applying a preset time", () => {
    const parsed = parseScheduleTime("12:00+");
    assert.equal(parsed.kind, "from");
    assert.equal(formatScheduleTimePart({ ...parsed, start: "10:00" }), "10:00+");
  });

  it("highlights presets for desde and rango, not only puntual", () => {
    assert.equal(scheduleTimePresetMatches("10:00+", "10:00"), true);
    assert.equal(scheduleTimePresetMatches("10:00-14:00", "10:00"), true);
    assert.equal(scheduleTimePresetMatches("10:00", "10:00"), true);
    assert.equal(scheduleTimePresetMatches("12:00+", "10:00"), false);
  });

  it("applies presets to hasta when targeting the range end", () => {
    assert.equal(applyScheduleTimePreset("10:00-14:00", "17:00", "end"), "10:00-17:00");
    assert.equal(applyScheduleTimePreset("10:00-14:00", "12:00", "start"), "12:00-14:00");
    assert.equal(scheduleTimePresetMatches("10:00-14:00", "14:00", "end"), true);
    assert.equal(scheduleTimePresetMatches("10:00-14:00", "14:00", "start"), false);
  });
});

describe("schedule time field eval", () => {
  it("routes range presets through the active desde or hasta target", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../components/sale/schedule-time-field.tsx"),
      "utf8",
    );

    assert.match(source, /rangeTarget/);
    assert.match(source, /Atajo para/);
    assert.match(source, /applyScheduleTimePreset\(value, time, presetTarget\(\)\)/);
    assert.match(source, /onFocus=\{\(\) => setRangeTarget\("end"\)\}/);
  });

  it("renders preset shortcuts above time inputs so the picker does not cover them", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../components/sale/schedule-time-field.tsx"),
      "utf8",
    );

    const presetIndex = source.indexOf("TIME_PRESETS.map");
    const timeInputIndex = source.indexOf("Hora exacta");

    assert.ok(presetIndex > -1);
    assert.ok(timeInputIndex > -1);
    assert.ok(presetIndex < timeInputIndex);
  });

  it("uses the custom grid time picker instead of native time inputs", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../components/sale/schedule-time-field.tsx"),
      "utf8",
    );
    const calendarSource = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../components/time-picker-calendar.tsx"),
      "utf8",
    );

    assert.match(source, /TimePickerInput/);
    assert.equal(source.includes('type="time"'), false);
    assert.equal(source.includes("openNativePicker"), false);
    assert.match(calendarSource, /Elige la hora/);
    assert.match(calendarSource, /Elige el minuto/);
    assert.match(calendarSource, /setStep\("minute"\)/);
  });
});
