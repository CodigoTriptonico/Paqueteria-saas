import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const shipmentsSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../app/actions/shipments.ts"),
  "utf8",
);
const logisticaSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/logistica-client.tsx"),
  "utf8",
);
const conductorSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/conductor/conductor-tareas-client.tsx"),
  "utf8",
);

describe("logistics reprogram eval", () => {
  it("exports reactivate action with preserving stock patch", () => {
    assert.match(shipmentsSource, /export async function reactivateLogisticsTaskAction/);
    assert.match(shipmentsSource, /shipment\.logistics_task_reactivated/);
    assert.match(shipmentsSource, /logisticsTaskReactivatePatchPreservingStock/);
  });

  it("wires reprogram panel and failed filter in logistica", () => {
    assert.match(logisticaSource, /LogisticsTaskReprogramPanel/);
    assert.match(logisticaSource, /failedFilter/);
    assert.match(logisticaSource, /Reprogramar/);
  });

  it("links conductor failure history to logistica", () => {
    assert.match(conductorSource, /buildLogisticaShipmentDeepLink/);
  });
});
