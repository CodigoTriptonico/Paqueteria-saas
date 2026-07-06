import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const contextMenuSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/shipment-step-context-menu.tsx"),
  "utf8",
);
const shipmentsSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../app/actions/shipments.ts"),
  "utf8",
);

describe("scheduled leg auto-order eval", () => {
  it("keeps schedule-only commits from ordering the driver task", () => {
    assert.match(contextMenuSource, /function commitDriverScheduled/);
    assert.match(contextMenuSource, /function commitDriverScheduled[\s\S]*?\[orderedKey\]: false/);
  });

  it("promotes due scheduled legs when listing shipments", () => {
    assert.match(shipmentsSource, /buildDueSchedulePromotionInput/);
    assert.match(shipmentsSource, /promoteDueScheduledLegsForListedShipments/);
  });
});
