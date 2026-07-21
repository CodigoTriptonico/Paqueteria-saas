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

  it("applies the same page layout to seller route proposals", () => {
    const approval = readFileSync(
      join(root, "components/logistica/customer-route-approval-panel.tsx"),
      "utf8",
    );
    assert.equal(approval.includes('usePageViewLayout("logistics.tasks")'), true);
    assert.equal(approval.includes('viewLayout === "rows"'), true);
    assert.equal(approval.includes("APPROVAL_CARD_GRID_CLASS"), true);
    assert.equal(approval.includes("lg:flex-row lg:items-center"), true);
    assert.equal(approval.includes("line-clamp-2"), true);
    assert.equal(approval.includes("text-base font-black leading-snug sm:text-lg"), true);
    assert.equal(approval.includes("Aprobar ruta"), true);
    assert.equal(approval.includes("Cambiar ruta"), true);
  });
});
