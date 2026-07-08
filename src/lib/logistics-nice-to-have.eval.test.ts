import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();

function readSource(relativePath: string) {
  return readFileSync(join(root, relativePath), "utf8");
}

describe("logistics nice-to-have eval", () => {
  it("wires KPIs, evidence, ETA and fleet capacity into logistica and conductor", () => {
    const logisticaSource = readSource("src/components/logistica-client.tsx");
    const conductorSource = readSource("src/components/conductor/conductor-tareas-client.tsx");
    const routesActionSource = readSource("src/app/actions/logistics-routes.ts");
    const routingSource = readSource("src/lib/logistics-routing.ts");

    assert.match(logisticaSource, /LogisticsKpisStrip/);
    assert.match(logisticaSource, /LogisticsEvidenceGallery/);
    assert.match(logisticaSource, /estimateRouteStopEtaMinutes/);
    assert.match(conductorSource, /estimateRouteStopEtaMinutes/);
    assert.match(routesActionSource, /listLogisticsTaskEvidenceAction/);
    assert.match(routesActionSource, /pickFleetCargoCapacityLimit/);
    assert.match(routingSource, /vehicleCargoCapacity/);
    assert.match(routingSource, /routeStopsWithinVehicleCapacity/);
  });
});
