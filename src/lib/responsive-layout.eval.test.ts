import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

describe("responsive layout eval", () => {
  it("keeps content visible on narrow screens instead of using a global clipping workaround", () => {
    const css = source("src/app/globals.css");

    assert.match(css, /\.app-modal-overlay[\s\S]*overflow-y: auto/);
    assert.match(css, /\.app-modal-content[\s\S]*overflow-y: auto/);
    assert.doesNotMatch(css, /body\s*\{[^}]*overflow:\s*hidden/);
    assert.doesNotMatch(css, /body\s*\{[^}]*overflow-x:\s*hidden/);
  });

  it("keeps the primary logistic dialogs readable when names and identifiers are long", () => {
    for (const path of [
      "src/components/logistica/logistics-task-edit-panel.tsx",
      "src/components/logistica/logistics-task-schedule-confirm-panel.tsx",
      "src/components/logistica/logistics-driver-change-dialog.tsx",
    ]) {
      const file = source(path);
      assert.match(file, /p-3 sm:p-4/);
      assert.match(file, /break-words/);
    }
  });

  it("keeps mobile reports scanable by showing metric labels next to each value", () => {
    const report = source("src/components/time-clock/time-clock-admin-client.tsx");

    assert.match(report, /<small className="text-\[9px\][^"]*sm:hidden">Regular<\/small>/);
    assert.match(report, /<small className="text-\[9px\][^"]*sm:hidden">Extra<\/small>/);
    assert.match(report, /<small className="text-\[9px\][^"]*sm:hidden">Total<\/small>/);
  });
});
