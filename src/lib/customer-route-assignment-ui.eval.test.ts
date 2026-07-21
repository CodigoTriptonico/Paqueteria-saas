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
  assert.match(panel, /showDriverPicker/);
  assert.equal(panel.includes("showDriverPicker ? resolvedDriverId : true"), false);
  assert.match(actions, /driver_id: driverId \|\| null/);
  assert.match(actions, /Completa fecha y ruta/);
  assert.equal(
    actions.includes(
      "No hay conductor para esta ruta. Configúralo en Rutas (predeterminado del día) o crea un conductor.",
    ),
    false,
  );
  assert.match(read("src/app/actions/logistics-routes.ts"), /Completa fecha y ruta/);
  assert.equal(
    read("src/app/actions/logistics-routes.ts").includes("Completa fecha, conductor y ruta"),
    false,
  );
  assert.match(approval, /Sin conductor todavía/);
  assert.match(approval, /Opcional\. Puedes asignar el conductor después/);
  assert.match(panel, /Sin conductor todavía/);
  assert.match(panel, /allowPendingRoute/);
  assert.match(panel, /onConfirmPendingRoute/);
  assert.equal(panel.includes("Logística debe configurarlo en Rutas"), false);
  assert.match(panel, /LogisticsWeekdayPicker/);
  assert.match(panel, /selectWeekday/);
  assert.match(panel, /nextWeekdayScheduleHint/);
  assert.match(panel, /availableWeekdays|enabledWeekdayIndexes/);
  assert.match(panel, /dayAsRoute/);
  assert.match(panel, /ensureLogisticsDayRouteTemplateAction/);
  assert.match(panel, /resolveDayRouteTemplateId/);
  assert.match(logistics, /CustomerRouteApprovalPanel/);
  assert.match(logistics, /templates=\{routeCatalog\?\.templates/);
  assert.match(logistics, /enabledDays=\{routeCatalog\?\.enabledDays/);
  assert.match(envios, /enabledDays=\{routeCatalog\.enabledDays\}/);
  assert.match(actions, /pending_approval/);
  assert.match(actions, /replaceCustomerRouteAssignmentRequestAction/);
  assert.match(actions, /customer\.route_assignment\.replaced/);
  assert.match(approval, /usePageViewLayout\("logistics\.tasks"\)/);
  assert.match(approval, /Aprobar ruta/);
  assert.match(approval, /Cambiar ruta/);
  assert.match(approval, /Asignar esta ruta/);
  assert.match(approval, /replaceCustomerRouteAssignmentRequestAction/);
  assert.match(approval, /LogisticsWeekdayPicker/);
  assert.match(approval, /selectReplaceWeekday/);
  assert.match(approval, /selectWeekdayDate/);
  assert.match(approval, /nextWeekdayScheduleHint/);
  assert.match(approval, /enabledWeekdayIndexes/);
  assert.match(approval, /dayAsRoute/);
  assert.match(approval, /ensureLogisticsDayRouteTemplateAction/);
  assert.match(approval, /Ruta del día/);
  assert.match(approval, /nextDateForAvailableWeekdays/);
  assert.equal(approval.includes('from "@/components/date-input"'), false);
  assert.equal(approval.includes("<DateInput"), false);
  assert.equal(approval.includes("selectReplaceDate"), false);
  assert.equal(approval.includes("availableEnabledDaysHint"), false);
  // Replace form order: Día → Ruta → Hora → Conductor
  {
    const dayIdx = approval.indexOf('ariaLabel="Día de la ruta de reemplazo"');
    const routeIdx = approval.indexOf('ariaLabel="Ruta de reemplazo"');
    const timeIdx = approval.indexOf('ariaLabel="Hora de la ruta de reemplazo"');
    const driverIdx = approval.indexOf('ariaLabel="Conductor de la ruta de reemplazo"');
    assert.ok(dayIdx > -1 && routeIdx > -1 && timeIdx > -1 && driverIdx > -1);
    assert.ok(dayIdx < routeIdx && routeIdx < timeIdx && timeIdx < driverIdx);
    assert.equal(approval.includes("grid gap-3 sm:grid-cols-2"), false);
  }
  // date-first confirm panel: Día → Ruta → Hora → Conductor
  {
    const dateFieldIdx = panel.indexOf("const dateField =");
    const routeFieldIdx = panel.indexOf("const routeField =");
    const timeFieldIdx = panel.indexOf("const timeField =");
    assert.ok(dateFieldIdx > -1 && routeFieldIdx > -1 && timeFieldIdx > -1);
    assert.match(panel, /dateField[\s\S]*routeField[\s\S]*timeField/);
    assert.equal(panel.includes("dateTimeFields"), false);
  }
  assert.equal(approval.includes("Solo días con rutas"), false);
  assert.equal(panel.includes("Solo días con rutas"), false);
  assert.match(read("src/app/actions/logistics-routes.ts"), /ensureLogisticsDayRouteTemplateAction/);
  assert.match(read("src/lib/logistics-day-route.ts"), /DAY_AS_ROUTE_TEMPLATE_ID/);
  assert.match(read("src/lib/logistics-day-route.ts"), /selectWeekdayDate/);
  assert.match(read("src/lib/logistics-day-route.ts"), /nextWeekdayScheduleHint/);
  assert.match(read("src/lib/logistics-day-route.ts"), /Días disponibles/);
  assert.match(read("src/components/logistica/logistics-weekday-picker.tsx"), /logisticsWeekdayChipLabels/);
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
