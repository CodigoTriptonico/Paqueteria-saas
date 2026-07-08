import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const logisticaSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/logistica-client.tsx"),
  "utf8",
);
const panelSource = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../components/logistica/logistics-task-edit-panel.tsx",
  ),
  "utf8",
);

describe("logistics task edit eval", () => {
  it("wires task edit panel and updateLogisticsTaskAction patch fields", () => {
    assert.match(logisticaSource, /LogisticsTaskEditPanel/);
    assert.match(logisticaSource, /changeTask\(/);
    assert.match(logisticaSource, /scheduledAt/);
    assert.match(logisticaSource, /warehouseId/);
    assert.match(panelSource, /ScheduleTimeField/);
    assert.match(panelSource, /buildLogisticsTaskEditPatch/);
  });
});
