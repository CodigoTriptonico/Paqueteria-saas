import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

test("seguimiento wires program-route into logistics approval flow", () => {
  const envios = read("src/components/envios-client.tsx");
  const menu = read("src/components/shipment-step-context-menu.tsx");
  const panel = read("src/components/logistica/logistics-task-schedule-confirm-panel.tsx");
  const logistics = read("src/components/logistica-client.tsx");
  const actions = read("src/app/actions/customer-route-assignments.ts");
  const labels = read("src/lib/shipment-leg-labels.ts");

  assert.match(menu, /Programar entrega|readyLabel/);
  assert.equal(menu.includes("onMarkReady"), false);
  assert.equal(menu.includes("Establecer una fecha"), false);
  assert.match(labels, /Programar entrega/);
  assert.match(labels, /No sé la ruta todavía/);
  assert.match(envios, /requestCustomerRouteAssignmentAction/);
  assert.match(envios, /confirmPendingRoute/);
  assert.match(envios, /allowPendingRoute/);
  assert.match(envios, /LogisticsTaskScheduleConfirmPanel/);
  assert.match(envios, /selectionOrder=\"date-first\"/);
  assert.match(envios, /showDriverPicker=\{false\}/);
  assert.match(envios, /allowPendingRoute/);
  assert.match(panel, /showDriverPicker/);
  assert.match(panel, /allowPendingRoute/);
  assert.match(panel, /onConfirmPendingRoute/);
  assert.match(panel, /Rutas de/);
  assert.match(panel, /Solo aparecen rutas de/);
  assert.match(logistics, /CustomerRouteApprovalPanel/);
  assert.match(actions, /pending_approval/);
  assert.match(read("src/app/actions/customers.ts"), /revokeCustomerRouteVerificationsForZoneChange/);
});
