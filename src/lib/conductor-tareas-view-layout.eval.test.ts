import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "components/conductor/conductor-tareas-client.tsx"),
  "utf8",
);
const sidebarControls = readFileSync(
  join(root, "components/ui/sidebar-page-surface-controls.tsx"),
  "utf8",
);

describe("conductor tareas view layout eval", () => {
  it("reads view layout from per-page preferences and toggles in sidebar", () => {
    assert.equal(source.includes('usePageViewLayout("conductor.tasks")'), true);
    assert.equal(source.includes("ViewLayoutToggle"), false);
    assert.equal(sidebarControls.includes("ViewLayoutToggle"), true);
  });

  it("renders row and card task lists with shared page palette", () => {
    assert.equal(source.includes('viewLayout === "rows"'), true);
    assert.equal(source.includes("ConductorTaskRow"), true);
    assert.equal(source.includes("ConductorTaskCard"), true);
    assert.equal(source.includes("listCardShellClass"), true);
    assert.equal(source.includes("listRowBaseClass"), true);
  });
});
