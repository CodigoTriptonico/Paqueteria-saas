import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "components/estadisticas/ventas-panel.tsx"), "utf8");
const sidebarControls = readFileSync(
  join(root, "components/ui/sidebar-page-surface-controls.tsx"),
  "utf8",
);

describe("estadisticas view layout eval", () => {
  it("reads view layout from per-page preferences and toggles in sidebar", () => {
    assert.equal(source.includes('usePageViewLayout("stats.sales")'), true);
    assert.equal(source.includes("ViewLayoutToggle"), false);
    assert.equal(sidebarControls.includes("ViewLayoutToggle"), true);
  });

  it("switches seller ranking and daily breakdown between rows and cards", () => {
    assert.equal(source.includes('viewLayout === "rows"'), true);
    assert.equal(source.includes("report.sellers.map"), true);
    assert.equal(source.includes("report.dailyBreakdown.map"), true);
    assert.equal(source.includes("listCardShellClass"), true);
    assert.equal(source.includes("listRowBaseClass"), true);
  });
});
