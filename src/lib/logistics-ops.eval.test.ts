import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const enviosSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/envios-client.tsx"),
  "utf8",
);
const conductorSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/conductor/conductor-tareas-client.tsx"),
  "utf8",
);
const logisticaSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/logistica-client.tsx"),
  "utf8",
);
const conductorActionsSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../app/actions/conductor-tasks.ts"),
  "utf8",
);

describe("logistics ops eval", () => {
  it("wires deep links, navigation, pickup inventory and live refresh", () => {
    assert.match(enviosSource, /buildLogisticaShipmentDeepLink/);
    assert.match(conductorSource, /buildMapsNavigationUrl/);
    assert.match(logisticaSource, /LOGISTICS_LIVE_REFRESH_MS/);
    assert.match(logisticaSource, /Board actualizado/);
    assert.match(conductorActionsSource, /pickup_full_box/);
    assert.match(conductorActionsSource, /hasPickupReturnEventForTaskLine/);
    assert.match(conductorActionsSource, /insertFullBoxCollectionEvent/);
  });
});
