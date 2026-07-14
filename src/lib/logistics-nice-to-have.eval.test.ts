import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();

function readSource(relativePath: string) {
  return readFileSync(join(root, relativePath), "utf8");
}

describe("logistics nice-to-have eval", () => {
  it("wires ETA, delivery evidence and fleet capacity into active logistics flows", () => {
    const logisticaSource = readSource("src/components/logistica-client.tsx");
    const conductorSource = readSource("src/components/conductor/conductor-tareas-client.tsx");
    const routingSource = readSource("src/lib/logistics-routing.ts");

    assert.match(logisticaSource, /estimateRouteStopEtaMinutes/);
    assert.match(conductorSource, /estimateRouteStopEtaMinutes/);
    assert.match(conductorSource, /formData\.set\("evidence", evidence\)/);
    assert.match(routingSource, /vehicleCargoCapacity/);
    assert.match(routingSource, /routeStopsWithinVehicleCapacity/);
  });
});
