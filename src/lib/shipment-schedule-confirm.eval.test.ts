import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const contextMenuSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/shipment-step-context-menu.tsx"),
  "utf8",
);

describe("shipment schedule confirm eval", () => {
  it("warns before marking ready against a future scheduled date", () => {
    assert.match(contextMenuSource, /markReadyConflictsWithScheduledDate/);
    assert.match(contextMenuSource, /markReadyScheduleConflictCopy/);
    assert.match(contextMenuSource, /function requestMarkDriverReady/);
    assert.match(contextMenuSource, /shipment-step-schedule-confirm/);
    assert.match(contextMenuSource, /ActionConfirmDialog/);
  });

  it("warns before applying a schedule on a different day", () => {
    assert.match(contextMenuSource, /applyScheduleChangesCommittedDate/);
    assert.match(contextMenuSource, /applyScheduleDateChangeCopy/);
    assert.match(contextMenuSource, /function requestDriverScheduled/);
  });
});
