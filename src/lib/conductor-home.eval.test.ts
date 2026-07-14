import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const homePageSource = readFileSync(join(root, "app/page.tsx"), "utf8");
const conductorHomeSource = readFileSync(
  join(root, "components/conductor/conductor-home-panel.tsx"),
  "utf8",
);
const dashboardSource = readFileSync(join(root, "lib/conductor-dashboard.ts"), "utf8");
const permissionsSource = readFileSync(join(root, "lib/auth/permissions.ts"), "utf8");
const conductorActionsSource = readFileSync(
  join(root, "app/actions/conductor-tasks.ts"),
  "utf8",
);

describe("conductor home eval", () => {
  it("routes conductor sessions to a dedicated home panel", () => {
    assert.match(homePageSource, /isConductorRole/);
    assert.match(homePageSource, /ConductorHomePanel/);
    assert.match(homePageSource, /listConductorDriverTasksAction/);
    assert.match(homePageSource, /getConductorTruckInventoryAction/);
    assert.match(homePageSource, /summarizeConductorTasks/);
  });

  it("shows operational pickup and delivery counts on conductor home", () => {
    assert.match(conductorHomeSource, /Cajas por dejar/);
    assert.match(conductorHomeSource, /por subir al camión/);
    assert.match(conductorHomeSource, /inventario-camion\?subir=1/);
    assert.match(conductorHomeSource, /en el camión · Carga lista/);
    assert.match(conductorHomeSource, /Cajas por recoger/);
    assert.doesNotMatch(conductorHomeSource, /Domicilios/);
    assert.match(conductorHomeSource, /Ver mis tareas/);
    assert.doesNotMatch(conductorHomeSource, /Tareas totales/);
    assert.doesNotMatch(conductorHomeSource, /Entregas vacías/);
    assert.doesNotMatch(conductorHomeSource, /Recogidas llenas/);
    assert.doesNotMatch(conductorHomeSource, /domicilio distinto/);
  });

  it("shows the assigned vehicle and active status before the driver starts a route", () => {
    assert.match(homePageSource, /getConductorHomeVehicleStatusAction/);
    assert.match(conductorHomeSource, /Vehículo de hoy/);
    assert.match(conductorHomeSource, /Vehículo inactivo/);
    assert.match(conductorActionsSource, /from\("logistics_vehicles"\)/);
    assert.match(conductorActionsSource, /El vehiculo no esta activo/);
  });

  it("summarizes conductor tasks deterministically", () => {
    assert.match(dashboardSource, /summarizeConductorTasks/);
    assert.match(dashboardSource, /deliverCount/);
    assert.match(dashboardSource, /pickupCount/);
    assert.doesNotMatch(dashboardSource, /addressCount/);
  });

  it("keeps envios out of conductor route access", () => {
    assert.match(permissionsSource, /conductor: \["\/", "\/conductor"\]/);
  });
});
