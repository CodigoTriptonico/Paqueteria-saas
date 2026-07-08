import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const migrationSource = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../../supabase/migrations/050_logistics_route_vehicle.sql",
  ),
  "utf8",
);
const routesSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../app/actions/logistics-routes.ts"),
  "utf8",
);
const logisticaSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/logistica-client.tsx"),
  "utf8",
);

describe("logistics route vehicle eval", () => {
  it("adds vehicle_id to logistics routes schema and actions", () => {
    assert.match(migrationSource, /vehicle_id uuid references public\.logistics_vehicles/);
    assert.match(routesSource, /vehicle_id/);
    assert.match(routesSource, /assignLogisticsRouteVehicleAction/);
    assert.match(logisticaSource, /assignLogisticsRouteVehicleAction/);
  });
});
