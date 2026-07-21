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
  const logistics = read("src/components/logistica-client.tsx");
  const actions = read("src/app/actions/customer-route-assignments.ts");

  assert.match(menu, /Programar en ruta/);
  assert.match(envios, /requestCustomerRouteAssignmentAction/);
  assert.match(envios, /LogisticsTaskScheduleConfirmPanel/);
  assert.match(logistics, /CustomerRouteApprovalPanel/);
  assert.match(logistics, /showRouteHistory/);
  assert.match(actions, /pending_approval/);
  assert.match(actions, /confirmLogisticsTaskScheduleAction/);
  assert.match(read("src/app/actions/customers.ts"), /revokeCustomerRouteVerificationsForZoneChange/);
});
