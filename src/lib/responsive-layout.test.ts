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
  assert.match(css, /\.text-truncate-safe/);
  assert.match(css, /overflow-clip-margin:\s*0\.25em/);
  assert.match(css, /padding-block:\s*0\.2em/);
  assert.match(css, /line-height:\s*1\.45/);
  assert.doesNotMatch(css, /\.text-truncate-safe[\s\S]*margin-block:/);
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

test("dense navigation and date controls reflow instead of being clipped on 320px screens", () => {
  const logisticsNav = source("src/components/logistica/logistics-section-nav.tsx");
  const salesMetrics = source("src/components/estadisticas/ventas-panel.tsx");
  const datePicker = source("src/components/date-picker-calendar.tsx");

  assert.match(logisticsNav, /flex w-full min-w-0 flex-wrap[\s\S]*sm:w-auto/);
  assert.match(salesMetrics, /grid h-10 w-full grid-cols-4[\s\S]*sm:w-auto/);
  assert.match(salesMetrics, /min-w-0 whitespace-nowrap px-1 text-\[11px\][\s\S]*sm:px-3 sm:text-xs/);
  assert.match(datePicker, /w-full max-w-\[17\.5rem\]/);
});
