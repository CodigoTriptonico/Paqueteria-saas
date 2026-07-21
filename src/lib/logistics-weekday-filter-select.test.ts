import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = join(import.meta.dirname, "../..");
const source = readFileSync(
  join(root, "src/components/logistica/logistics-weekday-filter-select.tsx"),
  "utf8",
);

describe("logistics weekday filter select", () => {
  it("keeps a dropdown trigger with chevron, not a chip row", () => {
    assert.match(source, /aria-haspopup="listbox"/);
    assert.match(source, /ChevronDown/);
    assert.match(source, /role="listbox"/);
    assert.match(source, /role="option"/);
    assert.equal(source.includes('role="group"'), false);
    assert.equal(source.includes("aria-pressed"), false);
  });

  it("colors trigger and options with the logistics day palette", () => {
    assert.match(source, /logisticsCalendarDayToneClass/);
    assert.match(source, /logisticsCalendarDaySelectedClass/);
    assert.match(source, /data-day-tone/);
    assert.match(source, /weekdayTones|tones\[/);
  });
});
