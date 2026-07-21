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
  const approval = read("src/components/logistica/customer-route-approval-panel.tsx");
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
  assert.match(panel, /resolveScheduleConfirmDriverId/);
  assert.match(panel, /showDriverPicker \? resolvedDriverId : true/);
  assert.match(panel, /showDriverPicker/);
  assert.match(actions, /driver_id: driverId \|\| null/);
  assert.match(actions, /Completa fecha y ruta/);
  assert.match(panel, /allowPendingRoute/);
  assert.match(panel, /onConfirmPendingRoute/);
  assert.equal(panel.includes("Logística debe configurarlo en Rutas"), false);
  assert.match(panel, /Solo días con rutas/);
  assert.match(panel, /nextDateForAvailableWeekdays/);
  assert.match(panel, /availableWeekdays/);
  assert.match(logistics, /CustomerRouteApprovalPanel/);
  assert.match(logistics, /templates=\{routeCatalog\?\.templates/);
  assert.match(actions, /pending_approval/);
  assert.match(actions, /replaceCustomerRouteAssignmentRequestAction/);
  assert.match(actions, /customer\.route_assignment\.replaced/);
  assert.match(approval, /usePageViewLayout\("logistics\.tasks"\)/);
  assert.match(approval, /Aprobar ruta/);
  assert.match(approval, /Cambiar ruta/);
  assert.match(approval, /Asignar esta ruta/);
  assert.match(approval, /replaceCustomerRouteAssignmentRequestAction/);
  assert.match(approval, /Solo días con rutas/);
  assert.match(approval, /Ruta del día/);
  assert.match(approval, /selectReplaceDate/);
  assert.match(approval, /nextDateForAvailableWeekdays/);
  assert.equal(approval.includes("justify-items-start"), false);
  assert.match(approval, /CircleAlert/);
  assert.match(approval, /Cómo funciona/);
  assert.equal(approval.includes("mb-3 text-sm font-bold text-slate-400"), false);
  assert.match(approval, /formattedAddress/);
  assert.match(approval, /ShipmentBoxLinesTrigger/);
  assert.match(approval, /Dirección/);
  assert.match(approval, /Cajas/);
  assert.match(actions, /readBoxLinesFromLogisticsPlan/);
  assert.match(actions, /formatted_address/);
  assert.match(actions, /logistics_plan/);
  assert.equal(approval.includes("Rechazar"), false);
  assert.match(read("src/app/actions/customers.ts"), /revokeCustomerRouteVerificationsForZoneChange/);
});
