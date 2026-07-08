import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ShipmentRow } from "@/app/actions/shipments";
import {
  buildConductorDriverTasks,
  isConductorTaskInScope,
  isTaskAssignedToDriver,
} from "@/lib/conductor-tasks";
import type { LogisticsRouteRow } from "@/lib/logistics-routing";

const SCOPE_DATE = "2026-07-07";

function shipment(partial: Partial<ShipmentRow> & Pick<ShipmentRow, "code">): ShipmentRow {
  return {
    id: partial.id || "ship-1",
    code: partial.code,
    customerId: null,
    recipientId: null,
    recipientSnapshot: null,
    customer_name: partial.customer_name || "Cliente",
    country: partial.country || "Mexico",
    carrier: "",
    paid: 0,
    profit: 0,
    status: "En oficina",
    assigned_to: partial.assigned_to ?? null,
    createdBy: null,
    salesOwnerId: null,
    salesOwnerName: "",
    sale_kind: "full",
    invoice_status: "open",
    invoice_priority: false,
    accounting_status: "not_exportable",
    created_at: null,
    finalized_at: null,
    empty_box_delivered_at: null,
    full_box_collected_at: null,
    office_received_at: null,
    departed_at: null,
    shipped_at: null,
    delivered_at: null,
    delivery_notes: "",
    logistics_plan: {},
    logisticsTasks: partial.logisticsTasks || [],
    payments: [],
  };
}

function route(partial: Partial<LogisticsRouteRow> & Pick<LogisticsRouteRow, "id" | "routeDate">): LogisticsRouteRow {
  return {
    id: partial.id,
    routeDate: partial.routeDate,
    name: partial.name ?? "Ruta",
    status: partial.status ?? "planned",
    assignedTo: partial.assignedTo ?? "driver-1",
    warehouseId: null,
    zoneKey: "north",
    notes: "",
    createdAt: "2026-07-07T10:00:00.000Z",
    updatedAt: "2026-07-07T10:00:00.000Z",
    stops: partial.stops ?? [],
  };
}

describe("conductor tasks", () => {
  it("lists open tasks assigned directly to the driver when scheduled today", () => {
    const tasks = buildConductorDriverTasks({
      driverId: "driver-1",
      routes: [],
      taskAddresses: [],
      scopeDate: SCOPE_DATE,
      shipments: [
        shipment({
          code: "INV-1",
          logisticsTasks: [
            {
              id: "task-1",
              shipmentId: "ship-1",
              taskType: "deliver_empty_box",
              status: "assigned",
              assignedTo: "driver-1",
              scheduledAt: "2026-07-07T15:00:00.000Z",
              warehouseId: null,
              notes: "",
              stockDeductedAt: null,
              completedAt: null,
              orderedAt: null,
              assignedAt: null,
              loadedAt: null,
              createdAt: "2026-07-07T12:00:00.000Z",
            },
          ],
        }),
      ],
    });

    assert.equal(tasks.length, 1);
    assert.equal(tasks[0]?.shipmentCode, "INV-1");
    assert.equal(tasks[0]?.taskType, "deliver_empty_box");
  });

  it("includes tasks inherited from a routed driver assignment on today's route", () => {
    const routes: LogisticsRouteRow[] = [
      route({
        id: "route-1",
        routeDate: SCOPE_DATE,
        name: "Ruta norte",
        assignedTo: "driver-2",
        stops: [
          {
            id: "stop-1",
            routeId: "route-1",
            taskId: "task-2",
            order: 1,
            address: {
              source: "customer",
              name: "Cliente",
              phone: "",
              street: "",
              houseNumber: "",
              neighborhood: "",
              city: "",
              state: "",
              postalCode: "",
              country: "México",
              formattedAddress: "Calle 1",
              placeId: "",
              lat: null,
              lng: null,
            },
            lat: null,
            lng: null,
            postalCode: "",
            city: "",
            createdAt: "2026-07-07T10:00:00.000Z",
          },
        ],
      }),
    ];

    const tasks = buildConductorDriverTasks({
      driverId: "driver-2",
      routes,
      taskAddresses: [],
      scopeDate: SCOPE_DATE,
      shipments: [
        shipment({
          code: "INV-2",
          logisticsTasks: [
            {
              id: "task-2",
              shipmentId: "ship-2",
              taskType: "pickup_full_box",
              status: "assigned",
              assignedTo: null,
              scheduledAt: null,
              warehouseId: null,
              notes: "",
              stockDeductedAt: null,
              completedAt: null,
              orderedAt: null,
              assignedAt: null,
              loadedAt: null,
              createdAt: "2026-07-07T11:00:00.000Z",
            },
          ],
        }),
      ],
    });

    assert.equal(tasks.length, 1);
    assert.equal(tasks[0]?.routeName, "Ruta norte");
    assert.equal(isTaskAssignedToDriver(
      { assignedTo: null, status: "assigned" },
      { route: routes[0]! },
      "driver-2",
    ), true);
  });

  it("skips completed tasks", () => {
    const tasks = buildConductorDriverTasks({
      driverId: "driver-1",
      routes: [],
      taskAddresses: [],
      scopeDate: SCOPE_DATE,
      shipments: [
        shipment({
          code: "INV-3",
          logisticsTasks: [
            {
              id: "task-3",
              shipmentId: "ship-3",
              taskType: "deliver_empty_box",
              status: "completed",
              assignedTo: "driver-1",
              scheduledAt: null,
              warehouseId: null,
              notes: "",
              stockDeductedAt: null,
              completedAt: "2026-07-07T16:00:00.000Z",
              orderedAt: null,
              assignedAt: null,
              loadedAt: null,
              createdAt: "2026-07-07T11:00:00.000Z",
            },
          ],
        }),
      ],
    });

    assert.equal(tasks.length, 0);
  });

  it("includes today's route and excludes a future route", () => {
    const routes: LogisticsRouteRow[] = [
      route({
        id: "route-today",
        routeDate: SCOPE_DATE,
        stops: [
          {
            id: "stop-today",
            routeId: "route-today",
            taskId: "task-today",
            order: 1,
            address: {
              source: "customer",
              name: "Cliente",
              phone: "",
              street: "",
              houseNumber: "",
              neighborhood: "",
              city: "",
              state: "",
              postalCode: "",
              country: "México",
              formattedAddress: "Calle 1",
              placeId: "",
              lat: null,
              lng: null,
            },
            lat: null,
            lng: null,
            postalCode: "",
            city: "",
            createdAt: "2026-07-07T10:00:00.000Z",
          },
        ],
      }),
      route({
        id: "route-future",
        routeDate: "2026-07-10",
        stops: [
          {
            id: "stop-future",
            routeId: "route-future",
            taskId: "task-future",
            order: 1,
            address: {
              source: "customer",
              name: "Cliente",
              phone: "",
              street: "",
              houseNumber: "",
              neighborhood: "",
              city: "",
              state: "",
              postalCode: "",
              country: "México",
              formattedAddress: "Calle 2",
              placeId: "",
              lat: null,
              lng: null,
            },
            lat: null,
            lng: null,
            postalCode: "",
            city: "",
            createdAt: "2026-07-07T10:00:00.000Z",
          },
        ],
      }),
    ];

    const tasks = buildConductorDriverTasks({
      driverId: "driver-1",
      routes,
      taskAddresses: [],
      scopeDate: SCOPE_DATE,
      shipments: [
        shipment({
          code: "INV-TODAY",
          logisticsTasks: [
            {
              id: "task-today",
              shipmentId: "ship-today",
              taskType: "deliver_empty_box",
              status: "assigned",
              assignedTo: null,
              scheduledAt: null,
              warehouseId: null,
              notes: "",
              stockDeductedAt: null,
              completedAt: null,
              orderedAt: null,
              assignedAt: null,
              loadedAt: null,
              createdAt: "2026-07-07T11:00:00.000Z",
            },
          ],
        }),
        shipment({
          id: "ship-future",
          code: "INV-FUTURE",
          logisticsTasks: [
            {
              id: "task-future",
              shipmentId: "ship-future",
              taskType: "deliver_empty_box",
              status: "assigned",
              assignedTo: null,
              scheduledAt: null,
              warehouseId: null,
              notes: "",
              stockDeductedAt: null,
              completedAt: null,
              orderedAt: null,
              assignedAt: null,
              loadedAt: null,
              createdAt: "2026-07-07T11:00:00.000Z",
            },
          ],
        }),
      ],
    });

    assert.equal(tasks.length, 1);
    assert.equal(tasks[0]?.id, "task-today");
  });

  it("keeps loaded_to_truck tasks even when route date is not today", () => {
    const routes: LogisticsRouteRow[] = [
      route({
        id: "route-past",
        routeDate: "2026-07-01",
        stops: [
          {
            id: "stop-past",
            routeId: "route-past",
            taskId: "task-loaded",
            order: 1,
            address: {
              source: "customer",
              name: "Cliente",
              phone: "",
              street: "",
              houseNumber: "",
              neighborhood: "",
              city: "",
              state: "",
              postalCode: "",
              country: "México",
              formattedAddress: "Calle 3",
              placeId: "",
              lat: null,
              lng: null,
            },
            lat: null,
            lng: null,
            postalCode: "",
            city: "",
            createdAt: "2026-07-01T10:00:00.000Z",
          },
        ],
      }),
    ];

    const tasks = buildConductorDriverTasks({
      driverId: "driver-1",
      routes,
      taskAddresses: [],
      scopeDate: SCOPE_DATE,
      shipments: [
        shipment({
          code: "INV-LOADED",
          logisticsTasks: [
            {
              id: "task-loaded",
              shipmentId: "ship-loaded",
              taskType: "deliver_empty_box",
              status: "loaded_to_truck",
              assignedTo: null,
              scheduledAt: null,
              warehouseId: null,
              notes: "",
              stockDeductedAt: "2026-07-01T08:00:00.000Z",
              completedAt: null,
              orderedAt: null,
              assignedAt: null,
              loadedAt: "2026-07-01T08:00:00.000Z",
              createdAt: "2026-07-01T07:00:00.000Z",
            },
          ],
        }),
      ],
    });

    assert.equal(tasks.length, 1);
    assert.equal(tasks[0]?.status, "loaded_to_truck");
  });

  it("includes direct tasks without route only when scheduled today", () => {
    const todayTask = {
      id: "task-today-direct",
      shipmentId: "ship-1",
      taskType: "deliver_empty_box" as const,
      status: "assigned" as const,
      assignedTo: "driver-1",
      scheduledAt: "2026-07-07T18:00:00.000Z",
      warehouseId: null,
      notes: "",
      stockDeductedAt: null,
      completedAt: null,
      orderedAt: null,
      assignedAt: null,
      loadedAt: null,
      createdAt: "2026-07-07T12:00:00.000Z",
    };
    const yesterdayTask = {
      ...todayTask,
      id: "task-yesterday-direct",
      scheduledAt: "2026-07-06T18:00:00.000Z",
    };

    const tasks = buildConductorDriverTasks({
      driverId: "driver-1",
      routes: [],
      taskAddresses: [],
      scopeDate: SCOPE_DATE,
      shipments: [
        shipment({
          code: "INV-TODAY-DIRECT",
          logisticsTasks: [todayTask, yesterdayTask],
        }),
      ],
    });

    assert.equal(tasks.length, 1);
    assert.equal(tasks[0]?.id, "task-today-direct");
    assert.equal(
      isConductorTaskInScope(
        { status: "assigned", scheduledAt: "2026-07-06T18:00:00.000Z", assignedTo: "driver-1" },
        undefined,
        SCOPE_DATE,
        "driver-1",
      ),
      false,
    );
  });

  it("includes direct assignments without schedule date", () => {
    const tasks = buildConductorDriverTasks({
      driverId: "driver-1",
      routes: [],
      taskAddresses: [],
      scopeDate: SCOPE_DATE,
      shipments: [
        shipment({
          code: "INV-NO-SCHEDULE",
          logisticsTasks: [
            {
              id: "task-no-schedule",
              shipmentId: "ship-1",
              taskType: "deliver_empty_box",
              status: "assigned",
              assignedTo: "driver-1",
              scheduledAt: null,
              warehouseId: null,
              notes: "",
              stockDeductedAt: null,
              completedAt: null,
              orderedAt: null,
              assignedAt: null,
              loadedAt: null,
              createdAt: "2026-07-07T12:00:00.000Z",
            },
          ],
        }),
      ],
    });

    assert.equal(tasks.length, 1);
    assert.equal(tasks[0]?.shipmentCode, "INV-NO-SCHEDULE");
  });

  it("includes routed tasks scheduled today even if route date differs", () => {
    const routes: LogisticsRouteRow[] = [
      route({
        id: "route-mismatch",
        routeDate: "2026-07-10",
        stops: [
          {
            id: "stop-mismatch",
            routeId: "route-mismatch",
            taskId: "task-scheduled-today",
            order: 1,
            address: {
              source: "customer",
              name: "Cliente",
              phone: "",
              street: "",
              houseNumber: "",
              neighborhood: "",
              city: "",
              state: "",
              postalCode: "",
              country: "México",
              formattedAddress: "Calle 4",
              placeId: "",
              lat: null,
              lng: null,
            },
            lat: null,
            lng: null,
            postalCode: "",
            city: "",
            createdAt: "2026-07-07T10:00:00.000Z",
          },
        ],
      }),
    ];

    const tasks = buildConductorDriverTasks({
      driverId: "driver-1",
      routes,
      taskAddresses: [],
      scopeDate: SCOPE_DATE,
      shipments: [
        shipment({
          code: "INV-SCHEDULED-TODAY",
          logisticsTasks: [
            {
              id: "task-scheduled-today",
              shipmentId: "ship-1",
              taskType: "deliver_empty_box",
              status: "assigned",
              assignedTo: null,
              scheduledAt: "2026-07-07T18:00:00.000Z",
              warehouseId: null,
              notes: "",
              stockDeductedAt: null,
              completedAt: null,
              orderedAt: null,
              assignedAt: null,
              loadedAt: null,
              createdAt: "2026-07-07T11:00:00.000Z",
            },
          ],
        }),
      ],
    });

    assert.equal(tasks.length, 1);
    assert.equal(tasks[0]?.shipmentCode, "INV-SCHEDULED-TODAY");
  });
});
