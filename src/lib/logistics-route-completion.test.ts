import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAutoCompleteRoute,
  routeCompletionBlockedReason,
} from "@/lib/logistics-route-completion";
import type { LogisticsRouteRow } from "@/lib/logistics-routing";

function route(
  overrides: Partial<LogisticsRouteRow> & Pick<LogisticsRouteRow, "status" | "stops">,
): LogisticsRouteRow {
  return {
    id: "route-1",
    routeDate: "2026-07-08",
    name: "Ruta A",
    assignedTo: "driver-1",
    warehouseId: null,
    zoneKey: "zone",
    notes: "",
    createdAt: "2026-07-08T10:00:00.000Z",
    updatedAt: "2026-07-08T10:00:00.000Z",
    ...overrides,
  };
}

describe("canAutoCompleteRoute", () => {
  it("returns true when planned route has only terminal stops", () => {
    const value = canAutoCompleteRoute(
      route({
        status: "planned",
        stops: [
          {
            id: "s1",
            routeId: "route-1",
            taskId: "t1",
            order: 1,
            address: {} as LogisticsRouteRow["stops"][number]["address"],
            lat: 1,
            lng: 2,
            postalCode: "",
            city: "",
            createdAt: "",
          },
          {
            id: "s2",
            routeId: "route-1",
            taskId: "t2",
            order: 2,
            address: {} as LogisticsRouteRow["stops"][number]["address"],
            lat: 1,
            lng: 2,
            postalCode: "",
            city: "",
            createdAt: "",
          },
        ],
      }),
      [
        { taskId: "t1", status: "completed" },
        { taskId: "t2", status: "cancelled" },
      ],
    );

    assert.equal(value, true);
  });

  it("returns false when a stop is still open", () => {
    const value = canAutoCompleteRoute(
      route({
        status: "planned",
        stops: [
          {
            id: "s1",
            routeId: "route-1",
            taskId: "t1",
            order: 1,
            address: {} as LogisticsRouteRow["stops"][number]["address"],
            lat: 1,
            lng: 2,
            postalCode: "",
            city: "",
            createdAt: "",
          },
        ],
      }),
      [{ taskId: "t1", status: "loaded_to_truck" }],
    );

    assert.equal(value, false);
  });

  it("returns false for draft or empty routes", () => {
    assert.equal(
      canAutoCompleteRoute(
        route({ status: "draft", stops: [] }),
        [],
      ),
      false,
    );
    assert.equal(
      routeCompletionBlockedReason(
        route({ status: "planned", stops: [] }),
        [],
      ),
      "La ruta no tiene paradas",
    );
  });
});
