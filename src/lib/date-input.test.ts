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
];

describe("date input standard", () => {
  it("uses a text-friendly native date field with click-to-open picker", () => {
    assert.equal(dateInputSource.includes('type="date"'), true);
    assert.equal(dateInputSource.includes("openDatePicker(inputRef.current)"), true);
    assert.match(dateInputSource, /onChange=\{\(event\) => onChange\(event\.target\.value\)\}/);
    assert.equal(
      dateInputSource.includes("[&::-webkit-calendar-picker-indicator]:hidden"),
      true,
    );
    const inputBlock = dateInputSource.slice(
      dateInputSource.indexOf("<input"),
      dateInputSource.indexOf("/>", dateInputSource.indexOf('type="date"')) + 2,
    );
    assert.equal(inputBlock.includes("onClick={() => openDatePicker(inputRef.current)}"), true);
    assert.match(dateInputSource, /onClick=\{\(\) => openDatePicker\(inputRef\.current\)\}/);
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
        source.includes("DateInput"),
        true,
        `${relativePath} should import DateInput`,
      );
    }
  });
});
