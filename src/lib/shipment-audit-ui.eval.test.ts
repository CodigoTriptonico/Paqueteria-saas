import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const panelSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/shipment-audit-panel.tsx"),
  "utf8",
);
const entrySource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/audit-history-entry.tsx"),
  "utf8",
);
const lineSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/audit-history-line.tsx"),
  "utf8",
);

describe("shipment audit UI eval", () => {
  it("dedupes and compacts audit rows into one line", () => {
    assert.equal(panelSource.includes("consolidateShipmentActivityHistory"), true);
    assert.equal(panelSource.includes("AuditHistoryEntry"), true);
    assert.equal(entrySource.includes("shipmentAuditActionLabel"), true);
    assert.equal(entrySource.includes("stepHistoryTimestamp"), true);
    assert.equal(lineSource.includes("whitespace-nowrap"), true);
    assert.equal(lineSource.includes("bg-surface-inset text-slate-300"), true);
    assert.doesNotMatch(panelSource, /Por \{row\.actorName\}/);
    assert.doesNotMatch(panelSource, /row\.description/);
  });
});
