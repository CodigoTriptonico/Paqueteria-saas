import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const logisticsEditSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "shipment-logistics-edit.ts"),
  "utf8",
);
const contextMenuSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/shipment-step-context-menu.tsx"),
  "utf8",
);

describe("schedule vs driver order eval", () => {
  it("requires an explicit order flag before syncing driver logistics tasks", () => {
    assert.match(logisticsEditSource, /driverTaskOrdered/);
    assert.match(logisticsEditSource, /function legDriverTaskNeeded/);
    assert.doesNotMatch(
      logisticsEditSource,
      /needed: input\.emptyBox\.mode === EMPTY_BOX_DRIVER_MODE/,
    );
  });

  it("marks ready separately from applying a schedule date", () => {
    assert.match(contextMenuSource, /function requestMarkDriverReady/);
    assert.match(contextMenuSource, /function commitMarkDriverReady/);
    assert.match(contextMenuSource, /DriverTaskOrdered/);
    assert.match(contextMenuSource, /function requestDriverScheduled/);
    assert.match(contextMenuSource, /function commitDriverScheduled/);
    assert.doesNotMatch(
      contextMenuSource,
      /onApplySchedule=\{applyMarkDriverReady\}/,
    );
  });

  it("outlines compact logistics tabs until the driver task exists", () => {
    const progressSource = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../components/shipment-progress-steps.tsx"),
      "utf8",
    );
    assert.match(progressSource, /function compactLogisticsLegUsesOutline/);
    assert.match(progressSource, /!step\.driverTaskOrdered/);
    assert.match(progressSource, /bg-amber-400/);
  });
});
