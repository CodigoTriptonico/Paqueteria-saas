import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const dateInputSource = readFileSync(join(root, "components/date-input.tsx"), "utf8");

const consumerFiles = [
  "components/logistica-client.tsx",
  "components/estadisticas/period-range-toolbar.tsx",
  "components/inventory-movements-panel.tsx",
  "components/sale/sale-logistics-step.tsx",
  "components/sale/sale-quick-empty-box-modal.tsx",
  "components/shipment-step-context-menu.tsx",
  "components/shipment-contact-log-dialog.tsx",
];

describe("date input standard", () => {
  it("uses a custom grid calendar with click-to-open picker", () => {
    assert.equal(dateInputSource.includes('type="date"'), false);
    assert.equal(dateInputSource.includes("DatePickerCalendar"), true);
    assert.equal(dateInputSource.includes('className="fixed z-[160]"'), true);
    assert.equal(dateInputSource.includes("formatDateInputDisplay(value)"), true);
    assert.equal(dateInputSource.includes("aria-haspopup=\"dialog\""), true);
    assert.match(dateInputSource, /onChange=\{pickDate\}/);
  });

  it("replaces raw date inputs across the app", () => {
    for (const relativePath of consumerFiles) {
      const source = readFileSync(join(root, relativePath), "utf8");
      assert.equal(
        source.includes('type="date"'),
        false,
        `${relativePath} still uses a raw date input`,
      );
      assert.equal(
        source.includes('type="datetime-local"'),
        false,
        `${relativePath} still uses a raw datetime input`,
      );
      assert.equal(
        source.includes("DateInput") || source.includes("DateTimeInput"),
        true,
        `${relativePath} should import DateInput or DateTimeInput`,
      );
    }
  });
});
