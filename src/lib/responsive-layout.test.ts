import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

test("shared responsive foundations protect intrinsic content without clipping it", () => {
  const css = source("src/app/globals.css");

  assert.match(css, /\*::before,[\s\S]*box-sizing: inherit/);
  assert.match(css, /overflow-wrap: anywhere/);
  assert.match(css, /img,[\s\S]*max-width: 100%/);
  assert.match(css, /\.app-modal-overlay[\s\S]*overflow-y: auto/);
  assert.match(css, /\.app-modal-content[\s\S]*max-height: calc\(100dvh - 1\.5rem\)/);
});

test("core dialogs scroll inside the available phone viewport", () => {
  const dialogSources = [
    "src/components/action-confirm-dialog.tsx",
    "src/components/logistica/logistics-task-edit-panel.tsx",
    "src/components/logistica/logistics-task-schedule-confirm-panel.tsx",
    "src/components/logistica/logistics-driver-change-dialog.tsx",
    "src/components/sale/sale-invoice-confirm-dialog.tsx",
    "src/components/sale/sale-quick-empty-box-modal.tsx",
    "src/components/sale/sale-quick-checkout-modal.tsx",
    "src/components/product-countries-modal.tsx",
  ];

  for (const path of dialogSources) {
    const file = source(path);
    assert.match(file, /app-modal-overlay/);
    assert.match(file, /app-modal-content/);
  }
});

test("time report becomes labelled metrics instead of a squeezed four-column table on mobile", () => {
  const report = source("src/components/time-clock/time-clock-admin-client.tsx");

  assert.match(report, /hidden grid-cols-\[minmax\(0,1fr\)_auto_auto_auto\][\s\S]*sm:grid/);
  assert.match(report, /grid grid-cols-3[\s\S]*sm:grid-cols-\[minmax\(0,1fr\)_auto_auto_auto\]/);
  assert.match(report, /sm:hidden">Regular/);
  assert.match(report, /sm:hidden">Extra/);
  assert.match(report, /sm:hidden">Total/);
});
