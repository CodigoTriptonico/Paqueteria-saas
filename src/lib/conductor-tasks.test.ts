import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ShipmentRow } from "@/app/actions/shipments";
import {
  buildConductorDriverTasks,
  isTaskAssignedToDriver,
} from "@/lib/conductor-tasks";
import type { LogisticsRouteRow } from "@/lib/logistics-routing";

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

describe("conductor tasks", () => {
  it("lists open tasks assigned directly to the driver", () => {
    const tasks = buildConductorDriverTasks({
      driverId: "driver-1",
      routes: [],
      taskAddresses: [],
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
              scheduledAt: "2026-07-05T15:00:00.000Z",
              warehouseId: null,
              notes: "",
              stockDeductedAt: null,
              completedAt: null,
              orderedAt: null,
              assignedAt: null,
              loadedAt: null,
              createdAt: "2026-07-05T12:00:00.000Z",
            },
          ],
        }),
      ],
    });

    assert.equal(tasks.length, 1);
    assert.equal(tasks[0]?.shipmentCode, "INV-1");
    assert.equal(tasks[0]?.taskType, "deliver_empty_box");
  });

  it("includes tasks inherited from a routed driver assignment", () => {
    const routes: LogisticsRouteRow[] = [
      {
        id: "route-1",
        routeDate: "2026-07-05",
        name: "Ruta norte",
        status: "planned",
        assignedTo: "driver-2",
        warehouseId: null,
        zoneKey: "north",
        notes: "",
        createdAt: "2026-07-05T10:00:00.000Z",
        updatedAt: "2026-07-05T10:00:00.000Z",
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
            createdAt: "2026-07-05T10:00:00.000Z",
          },
        ],
      },
    ];

    const tasks = buildConductorDriverTasks({
      driverId: "driver-2",
      routes,
      taskAddresses: [],
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
              createdAt: "2026-07-05T11:00:00.000Z",
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
              completedAt: "2026-07-05T16:00:00.000Z",
              orderedAt: null,
              assignedAt: null,
              loadedAt: null,
              createdAt: "2026-07-05T11:00:00.000Z",
            },
          ],
        }),
      ],
    });

    assert.equal(tasks.length, 0);
  });
});
