import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const shipmentsActionSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../app/actions/shipments.ts"),
  "utf8",
);
const displaySource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "shipment-display.ts"),
  "utf8",
);
const progressSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/shipment-progress-steps.tsx"),
  "utf8",
);
const contextMenuSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/shipment-step-context-menu.tsx"),
  "utf8",
);
const detailPanelSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/shipment-step-detail-panel.tsx"),
  "utf8",
);

describe("shipment schedule change eval", () => {
  it("records schedule updates with metadata and skips duplicate logistics audit", () => {
    assert.equal(shipmentsActionSource.includes("SHIPMENT_SCHEDULE_UPDATED_ACTION"), true);
    assert.equal(shipmentsActionSource.includes("applyScheduleChangeMetadata"), true);
    assert.equal(shipmentsActionSource.includes("hasLogisticsPlanChangeBesidesSchedule"), true);
    assert.equal(shipmentsActionSource.includes("scheduleAuditMetadata"), true);
    assert.equal(shipmentsActionSource.includes('source: "logistica"'), true);
  });

  it("shows visual schedule-changed markers in envios progress and menus", () => {
    assert.equal(displaySource.includes("scheduleChanged"), true);
    assert.equal(displaySource.includes("legHasScheduleChange"), true);
    assert.equal(progressSource.includes("Fecha modificada"), true);
    assert.equal(contextMenuSource.includes("scheduleChanged"), true);
  });

  it("renders schedule history with actor in step detail panel", () => {
    assert.equal(detailPanelSource.includes("AuditHistoryLine"), true);
    assert.equal(detailPanelSource.includes('row.action === "shipment.schedule_updated"'), true);
  });
});
