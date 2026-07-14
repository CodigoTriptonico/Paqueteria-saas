import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const globalsCss = readFileSync(join(root, "app/globals.css"), "utf8");
const inlineSearchPicker = readFileSync(
  join(root, "components/inline-search-picker.tsx"),
  "utf8",
);
const dateInput = readFileSync(join(root, "components/date-input.tsx"), "utf8");
const uiBlocks = readFileSync(join(root, "components/ui-blocks.tsx"), "utf8");

describe("inset field styling", () => {
  it("keeps card surfaces flat without a gray fill layer", () => {
    assert.match(globalsCss, /--surface-card:\s*#29312d;/);
    assert.match(globalsCss, /--surface-shell:\s*#29312d;/);
    assert.doesNotMatch(uiBlocks, /export const cardClass = "[^"]*bg-surface-card/);
    assert.doesNotMatch(uiBlocks, /bg-surface-panel shadow-md/);
    assert.match(uiBlocks, /bg-surface-list-row/);
    assert.match(globalsCss, /--surface-list-row:\s*#2c3340;/);
    assert.match(globalsCss, /--surface-shell:\s*#29312d;/);
  });

  it("keeps nested toolbar inputs transparent inside inset shells", () => {
    assert.match(globalsCss, /\.inset-shell input:not\(\.client-form-field\)/);
    assert.match(globalsCss, /\.bg-surface-inset input:not\(\.client-form-field\)/);
    assert.match(globalsCss, /input\.inset-field[\s\S]*background:\s*transparent/);
  });

  it("marks shared picker and date shells as inset-shell", () => {
    assert.match(uiBlocks, /export const insetShellClass = "inset-shell"/);
    assert.match(inlineSearchPicker, /insetShellClass/);
    assert.match(inlineSearchPicker, /inset-field/);
    assert.match(dateInput, /insetShellClass/);
    assert.match(dateInput, /inset-field/);
  });
});
