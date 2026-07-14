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

  it("does not auto-order driver tasks when listing shipments", () => {
    assert.match(shipmentsSource, /promoteDueScheduledLegsForListedShipments/);
    assert.doesNotMatch(
      shipmentsSource,
      /buildDueSchedulePromotionInput[\s\S]*?driverTaskOrdered:\s*true/,
    );
  });
});
