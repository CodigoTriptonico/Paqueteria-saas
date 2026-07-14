import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatTimeInput24,
  formatTimeInputDisplay,
  from12HourParts,
  parseTimeInput,
  resolveTimePickerView,
} from "./time-picker.ts";

describe("time picker", () => {
  it("parses and formats 24-hour values", () => {
    assert.deepEqual(parseTimeInput("14:30"), {
      hour24: 14,
      minute: 30,
      hour12: 2,
      period: "PM",
    });
    assert.equal(formatTimeInput24(14, 30), "14:30");
    assert.equal(formatTimeInputDisplay("12:00"), "12:00 PM");
    assert.equal(formatTimeInputDisplay(""), "—");
  });

  it("converts between 12-hour and 24-hour parts", () => {
    assert.equal(from12HourParts(12, 0, "AM"), "00:00");
    assert.equal(from12HourParts(12, 0, "PM"), "12:00");
    assert.equal(from12HourParts(1, 15, "PM"), "13:15");
  });

  it("resolves a default view when the value is empty", () => {
    assert.deepEqual(resolveTimePickerView(""), {
      hour24: 10,
      minute: 0,
      hour12: 10,
      period: "AM",
    });
    assert.deepEqual(resolveTimePickerView("17:45").hour24, 17);
  });
});
