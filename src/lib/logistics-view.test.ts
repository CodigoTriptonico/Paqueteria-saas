import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  activeLogisticsRouteTaskIds,
  buildLogisticaShipmentDeepLink,
  buildDriverPickerOptions,
  buildLogisticsDayRouteFilterOptions,
  buildTaskRoutePickerOptions,
  canChangeLogisticsTaskDriver,
  driverChangeDialogCopy,
  driverLabel,
  formatLogisticsTaskStatusLabel,
  isClosedLogisticsStatus,
  logisticsUnroutedTaskCardClass,
  logisticsScheduleDisplayParts,
  logisticsScheduleProximityClass,
  logisticsTaskWaitingParts,
  logisticsWaitingToneClass,
  logisticsActionIconWellClass,
  logisticsPriorityAwaitingDriver,
  logisticsPriorityAwaitingDriverClass,
  logisticsPriorityCardClass,
  logisticsPriorityHeaderClass,
  matchesLogisticsDateFilter,
  matchesLogisticsRouteTemplateFilter,
  matchesLogisticsWeekdayFilter,
  resolveLogisticsToolbarRoute,
  prioritizeLogisticsTasks,
  prioritizeMissingGeoTasks,
  resolveLogisticsInvoiceStep,
  sortLogisticsInvoiceItemsByPriority,
  resolveLogisticsShipmentDeepLink,
  routeCancelCopy,
  routeDriverChangeCopy,
  routeStopRemoveCopy,
  shouldConfirmDriverReplacement,
  splitLogisticsTasksByOpenState,
} from "./logistics-view";

function logisticsTask(
  overrides: Partial<{
    id: string;
    taskType: "deliver_empty_box" | "pickup_full_box";
    status: "pending" | "scheduled" | "assigned" | "loaded_to_truck" | "completed" | "cancelled";
    assignedTo: string | null;
  }>,
) {
  return {
    id: overrides.id || "task-1",
    taskType: overrides.taskType || "deliver_empty_box",
    status: overrides.status || "pending",
    assignedTo: overrides.assignedTo ?? null,
  };
}

describe("logistics view", () => {
  it("keeps active logistics tasks in one open list", () => {
    const split = splitLogisticsTasksByOpenState([
      { id: "pending", status: "pending" },
      { id: "scheduled", status: "scheduled" },
      { id: "assigned", status: "assigned" },
      { id: "loaded", status: "loaded_to_truck" },
      { id: "done", status: "completed" },
      { id: "cancelled", status: "cancelled" },
    ]);

    assert.deepEqual(
      split.open.map((task) => task.id),
      ["pending", "scheduled", "assigned", "loaded"],
    );
    assert.deepEqual(
      split.closed.map((task) => task.id),
      ["done", "cancelled"],
    );
  });

  it("only treats completed and cancelled as closed", () => {
    assert.equal(isClosedLogisticsStatus("completed"), true);
    assert.equal(isClosedLogisticsStatus("cancelled"), true);
    assert.equal(isClosedLogisticsStatus("assigned"), false);
  });

  it("shows assigned status with driver name", () => {
    const members = new Map([["driver-1", "Juan Perez"]]);

    assert.equal(
      formatLogisticsTaskStatusLabel("assigned", "driver-1", members),
      "Asignado a Juan Perez",
    );
    assert.equal(
      formatLogisticsTaskStatusLabel("assigned", null, members),
      "Asignado a sin chofer",
    );
    assert.equal(formatLogisticsTaskStatusLabel("pending", null, members), "Pendiente");
  });

  it("builds driver change dialog copy", () => {
    assert.equal(driverChangeDialogCopy(null, "driver-1").title, "Asignar chofer");
    assert.match(driverChangeDialogCopy(null, "driver-1").warningMessage, /asignado/i);
    assert.equal(driverChangeDialogCopy("driver-1", null).title, "Quitar chofer");
    assert.match(driverChangeDialogCopy("driver-1", null).warningMessage, /queda sin chofer/i);
    assert.equal(driverChangeDialogCopy("driver-1", "driver-2").title, "Reemplazar chofer");
    assert.match(driverChangeDialogCopy("driver-1", "driver-2").warningMessage, /cambia el chofer/i);
    assert.equal(
      driverChangeDialogCopy(null, "driver-1", { scope: "route" }).title,
      "Asignar chofer a la ruta",
    );
    assert.match(
      driverChangeDialogCopy(null, "driver-1", { scope: "route" }).warningMessage,
      /toda la ruta/i,
    );
    assert.equal(driverLabel(null, new Map()), "Sin asignar");
    assert.equal(driverLabel("driver-1", new Map([["driver-1", "Juan Perez"]])), "Juan Perez");
  });

  it("builds route confirm copy", () => {
    const members = new Map([["driver-1", "Juan Perez"]]);

    assert.match(routeCancelCopy("Ruta Centro", 2).message, /2 paradas/i);
    assert.match(routeStopRemoveCopy("INV-1").message, /INV-1/i);
    assert.match(
      routeDriverChangeCopy("Ruta Centro", null, "driver-1", members).message,
      /Juan Perez/i,
    );
  });

  it("confirms any driver assignment change", () => {
    assert.equal(shouldConfirmDriverReplacement(null, "driver-1"), true);
    assert.equal(shouldConfirmDriverReplacement("driver-1", null), true);
    assert.equal(shouldConfirmDriverReplacement("driver-1", "driver-1"), false);
    assert.equal(shouldConfirmDriverReplacement("driver-1", "driver-2"), true);
  });

  it("colors schedule dates by proximity to today", () => {
    const now = new Date("2026-07-03T12:00:00-07:00");

    assert.match(logisticsScheduleProximityClass(null, now), /border-yellow-500/);
    assert.match(
      logisticsScheduleProximityClass("2026-07-02T18:00:00-07:00", now),
      /border-red-500/,
    );
    assert.match(
      logisticsScheduleProximityClass("2026-07-03T18:00:00-07:00", now),
      /border-red-500/,
    );
    assert.match(
      logisticsScheduleProximityClass("2026-07-04T18:00:00-07:00", now),
      /border-amber-500/,
    );
    assert.match(
      logisticsScheduleProximityClass("2026-07-06T18:00:00-07:00", now),
      /border-violet-500/,
    );
    assert.match(
      logisticsScheduleProximityClass("2026-07-10T18:00:00-07:00", now),
      /border-sky-500/,
    );
  });

  it("labels schedule proximity with readable relative time", () => {
    const now = new Date("2026-07-04T12:00:00-07:00");

    assert.deepEqual(logisticsScheduleDisplayParts(null, now), {
      primary: "Sin fecha",
      secondary: null,
    });
    assert.deepEqual(logisticsScheduleDisplayParts("2026-07-03T18:00:00-07:00", now), {
      primary: logisticsScheduleDisplayParts("2026-07-03T18:00:00-07:00", now).primary,
      secondary: "hace 1 día",
    });
    assert.match(
      logisticsScheduleDisplayParts("2026-07-03T18:00:00-07:00", now).primary,
      /3 jul/i,
    );
    assert.equal(logisticsScheduleDisplayParts("2026-07-04T18:00:00-07:00", now).secondary, "hoy");
    assert.equal(logisticsScheduleDisplayParts("2026-07-05T18:00:00-07:00", now).secondary, "mañana");
  });

  it("colors waiting banners by elapsed time, not schedule date", () => {
    const minute = 60_000;

    assert.match(logisticsWaitingToneClass(24 * minute), /text-slate-400/);
    assert.match(logisticsWaitingToneClass(4 * 60 * minute), /text-slate-300/);
    assert.match(logisticsWaitingToneClass(36 * 60 * minute), /text-amber-300/);
    assert.match(logisticsWaitingToneClass(4 * 24 * 60 * minute), /text-amber-200/);
  });

  it("styles deliver and pickup action icons with distinct wells", () => {
    assert.match(logisticsActionIconWellClass("deliver_empty_box"), /border-sky-700/);
    assert.match(logisticsActionIconWellClass("pickup_full_box"), /border-violet-700/);
  });

  it("pulses priority markers only while a driver is still missing", () => {
    assert.equal(logisticsPriorityAwaitingDriver(true, null, true), true);
    assert.equal(logisticsPriorityAwaitingDriver(true, "driver-1", true), false);
    assert.equal(logisticsPriorityAwaitingDriver(false, null, true), false);
    assert.equal(logisticsPriorityAwaitingDriver(true, null, false), false);
    assert.equal(
      logisticsPriorityAwaitingDriverClass(true, null, true),
      "logistics-priority-awaiting-driver",
    );
    assert.equal(logisticsPriorityAwaitingDriverClass(true, "driver-1", true), "");
    assert.match(logisticsPriorityCardClass(true), /border-amber-600/);
    assert.equal(logisticsPriorityCardClass(true), "border-amber-600");
    assert.equal(logisticsPriorityHeaderClass(true), "bg-amber-950/45");
    assert.equal(logisticsPriorityHeaderClass(true), "bg-amber-950/45");
  });

  it("builds logistica deep links from shipment codes", () => {
    assert.equal(buildLogisticaShipmentDeepLink("INV-42"), "/logistica?q=INV-42");
    assert.equal(buildLogisticaShipmentDeepLink("  "), "/logistica");
    assert.equal(buildLogisticaShipmentDeepLink("A/B"), "/logistica?q=A%2FB");
  });

  it("resolves deep link focus to routed tasks when possible", () => {
    const tasks = [
      { id: "task-1", shipment: { code: "INV-1" } },
      { id: "task-2", shipment: { code: "INV-2" } },
    ];
    const routeByTaskId = new Map([
      ["task-2", { route: { id: "route-9" } }],
    ]);

    assert.deepEqual(resolveLogisticsShipmentDeepLink("inv-2", tasks, routeByTaskId), {
      query: "inv-2",
      routeId: "route-9",
      highlightTaskId: "task-2",
      clearDateFilter: true,
    });
    assert.deepEqual(resolveLogisticsShipmentDeepLink("INV-1", tasks, routeByTaskId), {
      query: "INV-1",
      routeId: null,
      highlightTaskId: "task-1",
      clearDateFilter: true,
    });
  });

  it("prioritizes missing geo tasks ahead of routable ones", () => {
    const tasks = [
      { id: "ready", geo: true },
      { id: "missing", geo: false },
      { id: "also-ready", geo: true },
    ];

    assert.deepEqual(
      prioritizeMissingGeoTasks(tasks, (task) => !task.geo).map((task) => task.id),
      ["missing", "ready", "also-ready"],
    );
  });

  it("sorts logistics invoice items with priority first", () => {
    const items = sortLogisticsInvoiceItemsByPriority([
      {
        shipment: { invoice_priority: false, created_at: "2026-07-05T12:00:00.000Z" },
      },
      {
        shipment: { invoice_priority: true, created_at: "2026-07-04T12:00:00.000Z" },
      },
      {
        shipment: { invoice_priority: true, created_at: "2026-07-05T10:00:00.000Z" },
      },
    ]);

    assert.deepEqual(
      items.map((item) => item.shipment.created_at),
      ["2026-07-05T10:00:00.000Z", "2026-07-04T12:00:00.000Z", "2026-07-05T12:00:00.000Z"],
    );
  });

  it("keeps missing geo first while sorting priority inside each bucket", () => {
    const tasks = [
      { id: "ready-normal", geo: true, shipment: { invoice_priority: false, created_at: "1" } },
      { id: "missing-priority", geo: false, shipment: { invoice_priority: true, created_at: "2" } },
      { id: "missing-normal", geo: false, shipment: { invoice_priority: false, created_at: "3" } },
      { id: "ready-priority", geo: true, shipment: { invoice_priority: true, created_at: "4" } },
    ];

    assert.deepEqual(
      prioritizeLogisticsTasks(tasks, {
        missingGeo: (task) => !task.geo,
        shipment: (task) => task.shipment,
      }).map((task) => task.id),
      ["missing-priority", "missing-normal", "ready-priority", "ready-normal"],
    );
  });

  it("styles unrouted cards for missing geo and deep-link focus", () => {
    assert.match(
      logisticsUnroutedTaskCardClass({ missingGeo: true, highlighted: false }),
      /border-amber-600/,
    );
    assert.match(
      logisticsUnroutedTaskCardClass({ missingGeo: false, highlighted: true }),
      /ring-emerald-400/,
    );
  });

  it("uses empty box delivery as the current invoice step until completed", () => {
    const step = resolveLogisticsInvoiceStep({
      logisticsTasks: [
        logisticsTask({ id: "empty", taskType: "deliver_empty_box", status: "assigned", assignedTo: "driver-1" }),
        logisticsTask({ id: "full", taskType: "pickup_full_box", status: "pending" }),
      ],
    });

    assert.equal(step?.stepType, "deliver_empty_box");
    assert.equal(step?.currentTask?.id, "empty");
    assert.equal(step?.nextTask?.id, "full");
    assert.equal(step?.assignment, "assigned");
  });

  it("moves pickup to the current step only after empty box delivery is completed", () => {
    const step = resolveLogisticsInvoiceStep({
      logisticsTasks: [
        logisticsTask({ id: "empty", taskType: "deliver_empty_box", status: "completed" }),
        logisticsTask({ id: "full", taskType: "pickup_full_box", status: "pending" }),
      ],
    });

    assert.equal(step?.stepType, "pickup_full_box");
    assert.equal(step?.currentTask?.id, "full");
    assert.equal(step?.canAssignDriver, true);
    assert.equal(step?.assignment, "unassigned");
  });

  it("does not allow assigning pickup while delivery is still loaded to truck", () => {
    const step = resolveLogisticsInvoiceStep({
      logisticsTasks: [
        logisticsTask({ id: "empty", taskType: "deliver_empty_box", status: "loaded_to_truck" }),
        logisticsTask({ id: "full", taskType: "pickup_full_box", status: "pending", assignedTo: "driver-1" }),
      ],
    });

    assert.equal(step?.stepType, "deliver_empty_box");
    assert.equal(step?.currentTask?.id, "empty");
    assert.equal(step?.nextTask?.id, "full");
    assert.equal(step?.canAssignDriver, true);
  });

  it("keeps pickup as the next step with no driver control when empty delivery has no completed task", () => {
    const step = resolveLogisticsInvoiceStep({
      logisticsTasks: [
        logisticsTask({ id: "full", taskType: "pickup_full_box", status: "pending" }),
      ],
    });

    assert.equal(step?.stepType, "deliver_empty_box");
    assert.equal(step?.currentTask, null);
    assert.equal(step?.nextTask?.id, "full");
    assert.equal(step?.canAssignDriver, false);
  });

  it("only exposes current route task ids", () => {
    const waiting = activeLogisticsRouteTaskIds([
      {
        logisticsTasks: [
          logisticsTask({ id: "empty", taskType: "deliver_empty_box", status: "assigned" }),
          logisticsTask({ id: "full", taskType: "pickup_full_box", status: "pending" }),
        ],
      },
    ]);
    const ready = activeLogisticsRouteTaskIds([
      {
        logisticsTasks: [
          logisticsTask({ id: "empty", taskType: "deliver_empty_box", status: "completed" }),
          logisticsTask({ id: "full", taskType: "pickup_full_box", status: "pending" }),
        ],
      },
    ]);
    const blocked = activeLogisticsRouteTaskIds([
      {
        logisticsTasks: [
          logisticsTask({ id: "full", taskType: "pickup_full_box", status: "pending" }),
        ],
      },
    ]);

    assert.deepEqual([...waiting], ["empty"]);
    assert.deepEqual([...ready], ["full"]);
    assert.deepEqual([...blocked], []);
  });

  it("builds searchable driver picker options with an empty choice", () => {
    const options = buildDriverPickerOptions(
      [
        { id: "driver-1", label: "Conductor 1" },
        { id: "driver-2", label: "Conductor 2" },
      ],
      "Sin asignar",
    );

    assert.equal(options.length, 3);
    assert.equal(options[0]?.value, "");
    assert.equal(options[0]?.label, "Sin asignar");
    assert.equal(options[1]?.label, "Conductor 1");
    assert.equal(options[2]?.searchText, "Conductor 2");
  });

  it("allows assigning a driver after the task is already on a draft route", () => {
    assert.equal(
      canChangeLogisticsTaskDriver({
        status: "scheduled",
        invoiceAllowsDriver: true,
        onRoute: true,
        routeStatus: "draft",
        canManageRoutes: true,
      }),
      true,
    );
    assert.equal(
      canChangeLogisticsTaskDriver({
        status: "scheduled",
        invoiceAllowsDriver: true,
        onRoute: true,
        routeStatus: "planned",
        canManageRoutes: true,
      }),
      false,
    );
    assert.equal(
      canChangeLogisticsTaskDriver({
        status: "scheduled",
        invoiceAllowsDriver: true,
        onRoute: true,
        routeStatus: "draft",
        canManageRoutes: false,
      }),
      false,
    );
    assert.equal(
      canChangeLogisticsTaskDriver({
        status: "scheduled",
        invoiceAllowsDriver: true,
        onRoute: false,
      }),
      true,
    );
    assert.equal(
      canChangeLogisticsTaskDriver({
        status: "completed",
        invoiceAllowsDriver: true,
        onRoute: false,
      }),
      false,
    );
  });

  it("resolves the operational route for the toolbar day+route+date filter", () => {
    const routes = [
      {
        id: "r-other",
        name: "Otra",
        status: "draft",
        routeDate: "2026-07-25",
        routeTemplateId: "tpl-other",
        assignedTo: null,
        stops: [{}],
      },
      {
        id: "r-vn",
        name: "Van Nuys",
        status: "draft",
        routeDate: "2026-07-25",
        routeTemplateId: "tpl-vn",
        assignedTo: null,
        stops: [{}, {}],
      },
      {
        id: "r-vn-cancelled",
        name: "Van Nuys",
        status: "cancelled",
        routeDate: "2026-07-25",
        routeTemplateId: "tpl-vn",
        assignedTo: null,
        stops: [],
      },
    ];

    assert.equal(
      resolveLogisticsToolbarRoute({
        routes,
        routeTemplateId: "tpl-vn",
        routeDate: "2026-07-25",
      })?.id,
      "r-vn",
    );
    assert.equal(
      resolveLogisticsToolbarRoute({
        routes,
        routeTemplateId: "tpl-vn",
        routeDate: "2026-07-26",
      }),
      null,
    );
    assert.equal(
      resolveLogisticsToolbarRoute({
        routes,
        routeTemplateId: "",
        routeDate: "2026-07-25",
      }),
      null,
    );
  });

  it("matches weekday and route-template filters for the logistics toolbar", () => {
    assert.equal(
      matchesLogisticsWeekdayFilter({
        weekdayFilter: null,
        scheduledAt: "2026-07-25T17:00:00.000Z",
      }),
      true,
    );
    assert.equal(
      matchesLogisticsWeekdayFilter({
        weekdayFilter: 5,
        scheduledAt: "2026-07-25T17:00:00.000Z",
      }),
      true,
    );
    assert.equal(
      matchesLogisticsWeekdayFilter({
        weekdayFilter: 0,
        scheduledAt: "2026-07-25T17:00:00.000Z",
      }),
      false,
    );
    assert.equal(
      matchesLogisticsWeekdayFilter({
        weekdayFilter: 5,
        routeDate: "2026-07-25",
      }),
      true,
    );
    assert.equal(
      matchesLogisticsRouteTemplateFilter({
        routeTemplateIdFilter: "",
        routeTemplateId: "hollywood",
      }),
      true,
    );
    assert.equal(
      matchesLogisticsRouteTemplateFilter({
        routeTemplateIdFilter: "hollywood",
        routeTemplateId: "hollywood",
      }),
      true,
    );
    assert.equal(
      matchesLogisticsRouteTemplateFilter({
        routeTemplateIdFilter: "hollywood",
        routeTemplateId: "van",
      }),
      false,
    );
    assert.equal(
      matchesLogisticsDateFilter({
        dateFilter: "",
        scheduledAt: "2026-07-25T17:00:00.000Z",
      }),
      true,
    );
    assert.equal(
      matchesLogisticsDateFilter({
        dateFilter: "2026-07-25",
        scheduledAt: "2026-07-25T17:00:00.000Z",
      }),
      true,
    );
    assert.equal(
      matchesLogisticsDateFilter({
        dateFilter: "2026-07-24",
        scheduledAt: "2026-07-25T17:00:00.000Z",
        routeDate: "2026-07-24",
      }),
      true,
    );
    assert.equal(
      matchesLogisticsDateFilter({
        dateFilter: "2026-07-18",
        scheduledAt: "2026-07-25T17:00:00.000Z",
        routeDate: "2026-07-25",
      }),
      false,
    );
  });

  it("builds day-scoped route filter options for the toolbar", () => {
    const allDays = buildLogisticsDayRouteFilterOptions({
      weekday: null,
      templates: [
        { id: "hollywood", name: "Hollywood", weekday: 5 },
        { id: "van", name: "Van Nuys", weekday: 5 },
        { id: "mon", name: "Lunes centro", weekday: 0 },
      ],
      enabledWeekdays: ["Sab", "Lun"],
    });
    assert.equal(allDays.length, 1);
    assert.equal(allDays[0]?.label, "Todas las rutas");

    const sab = buildLogisticsDayRouteFilterOptions({
      weekday: 5,
      templates: [
        { id: "hollywood", name: "Hollywood", weekday: 5 },
        { id: "van", name: "Van Nuys", weekday: 5 },
        { id: "mon", name: "Lunes centro", weekday: 0 },
      ],
      enabledWeekdays: ["Sab", "Lun"],
    });
    assert.equal(sab.length, 3);
    assert.equal(sab[1]?.value, "hollywood");
    assert.equal(sab[2]?.value, "van");
  });

  it("builds searchable route picker options for the task date", () => {
    const options = buildTaskRoutePickerOptions({
      routes: [
        {
          id: "route-1",
          name: "Ruta Norte",
          routeDate: "2026-07-06",
          routeTemplateId: "template-1",
          assignedTo: "driver-1",
          status: "draft",
        },
        { id: "route-2", name: "Ruta Sur", routeDate: "2026-07-12", assignedTo: null },
      ],
      templates: [
        { id: "template-1", name: "Ruta del lunes", weekday: 0 },
        { id: "template-2", name: "Ruta del sabado", weekday: 5 },
      ],
      enabledWeekdays: ["Lun", "Sab"],
      taskDate: "2026-07-06",
      driverLabelById: new Map([["driver-1", "Conductor 1"]]),
    });

    assert.equal(options.length, 3);
    assert.equal(options[0]?.value, "");
    assert.equal(options[0]?.label, "Sin ruta");
    assert.equal(options[1]?.value, "route:route-1");
    assert.match(options[1]?.searchText || "", /Conductor 1/);
    assert.equal(options[2]?.value, "template:template-2");
    assert.equal(options[2]?.label, "Ruta del sabado (Sab)");
  });

  it("shows weekly templates when no operational route exists yet", () => {
    const options = buildTaskRoutePickerOptions({
      routes: [],
      templates: [{ id: "template-1", name: "Ruta del lunes", weekday: 0 }],
      enabledWeekdays: ["Lun"],
      taskDate: "2026-07-06",
    });

    assert.equal(options.length, 2);
    assert.equal(options[1]?.value, "template:template-1");
    assert.equal(options[1]?.label, "Ruta del lunes (Lun)");
  });

  it("shows monday template on saturday task when only monday is enabled", () => {
    const options = buildTaskRoutePickerOptions({
      routes: [],
      templates: [{ id: "template-1", name: "Ruta del lunes", weekday: 0 }],
      enabledWeekdays: ["Lun"],
      taskDate: "2026-07-11",
    });

    assert.equal(options.length, 2);
    assert.equal(options[1]?.value, "template:template-1");
    assert.equal(options[1]?.label, "Ruta del lunes (Lun)");
  });

  it("builds waiting copy from when the logistics task was ordered", () => {
    const now = Date.parse("2026-03-10T19:00:00.000Z");

    assert.equal(
      logisticsTaskWaitingParts(
        "deliver_empty_box",
        "2026-03-10T12:00:00.000Z",
        "2026-03-10T11:00:00.000Z",
        now,
      )?.waitingText,
      "Lleva 7 horas desde que se solicitó la entrega",
    );
    assert.equal(
      logisticsTaskWaitingParts(
        "pickup_full_box",
        null,
        "2026-03-10T12:00:00.000Z",
        now,
      )?.waitingText,
      "Lleva 7 horas desde que se solicitó la recolección",
    );
    assert.equal(
      logisticsTaskWaitingParts("deliver_empty_box", null, null, now),
      null,
    );
  });
});
