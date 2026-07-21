import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const routesSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../app/actions/logistics-routes.ts"),
  "utf8",
);
const conductorSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../app/actions/conductor-tasks.ts"),
  "utf8",
);
const arrivalPanelSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/conductor/conductor-route-arrival-panel.tsx"),
  "utf8",
);
const migrationSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../supabase/migrations/120_conductor_route_arrival.sql"),
  "utf8",
);

describe("manual conductor route arrival eval", () => {
  it("does not close the route automatically after a task result", () => {
    assert.doesNotMatch(routesSource, /tryAutoCompleteLogisticsRoute/);
    assert.doesNotMatch(conductorSource, /tryAutoCompleteLogisticsRoute/);
  });

  it("requires an explicit warehouse and reason from the conductor", () => {
    assert.match(conductorSource, /completeConductorRouteArrivalAction/);
    assert.match(conductorSource, /complete_conductor_route_arrival/);
    assert.match(arrivalPanelSource, /Llegué a bodega/);
    assert.match(arrivalPanelSource, /¿Dónde dejaste las cajas\?/);
    assert.match(arrivalPanelSource, /¿Por qué terminaste\?/);
    assert.match(arrivalPanelSource, /role="alert"/);
    assert.match(arrivalPanelSource, /aria-pressed=\{selected\}/);
  });

  it("stores the actual arrival separately and keeps package custody with the driver", () => {
    assert.match(migrationSource, /arrival_warehouse_id/);
    assert.match(migrationSource, /arrival_reason_code/);
    assert.match(migrationSource, /status = 'in_truck'/);
    assert.doesNotMatch(migrationSource, /set\s+status\s*=\s*'at_warehouse'/);
  });
});
