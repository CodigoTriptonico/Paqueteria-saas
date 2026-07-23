import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

test("venta creates driver tasks and keeps a recoverable route workflow", () => {
  const venta = read("src/components/venta-client.tsx");
  const saleStep = read("src/components/sale/sale-logistics-step.tsx");
  const scheduler = read("src/components/logistica/logistics-task-schedule-confirm-panel.tsx");
  const shipments = read("src/app/actions/shipments.ts");

  assert.match(venta, /buildSaleLogisticsTasks/);
  assert.match(venta, /requestCustomerRouteAssignmentAction/);
  assert.match(venta, /routeAssignmentRetries/);
  assert.match(venta, /Reintentar \{retry\.label\.toLowerCase\(\)\}/);
  assert.match(venta, /allowPendingRoute/);
  assert.match(venta, /requireExplicitRouteSelection/);
  assert.match(venta, /openRoutePlanner\("emptyBox"\)/);
  assert.match(venta, /openRoutePlanner\("fullBox"\)/);
  assert.equal(saleStep.includes("Ruta del chofer"), false);
  assert.equal(saleStep.includes("Elegir ruta"), false);
  assert.equal(saleStep.includes("Cambiar ruta"), false);
  assert.equal(saleStep.includes("SchedulePanel"), false);
  assert.match(saleStep, /Quedó así/);
  assert.match(scheduler, /pendingRouteDate/);
  assert.match(scheduler, /Ruta pendiente conserva el día/);
  assert.match(shipments, /requestedRouteDate/);
  assert.match(shipments, /logisticsRequestedRouteDayPatch/);
});
