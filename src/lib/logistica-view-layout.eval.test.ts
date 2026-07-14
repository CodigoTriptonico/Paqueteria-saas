import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "components/logistica-client.tsx"), "utf8");
const sidebarControls = readFileSync(
  join(root, "components/ui/sidebar-page-surface-controls.tsx"),
  "utf8",
);

describe("logistica view layout eval", () => {
  it("reads view layout from per-page preferences and toggles in sidebar", () => {
    assert.equal(source.includes('usePageViewLayout("logistics.tasks")'), true);
    assert.equal(source.includes("ViewLayoutToggle"), false);
    assert.equal(sidebarControls.includes("ViewLayoutToggle"), true);
    assert.equal(sidebarControls.includes("usePageViewLayout"), true);
  });

  it("renders row and card invoice lists with shared page palette", () => {
    assert.equal(source.includes('viewLayout === "rows"'), true);
    assert.equal(source.includes("renderInvoiceRow"), true);
    assert.equal(source.includes("renderInvoiceCard"), true);
    assert.equal(source.includes("listCardShellClass"), true);
    assert.equal(source.includes("listRowBaseClass"), true);
  });
});
