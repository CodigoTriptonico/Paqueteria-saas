import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseVehicleCargoCapacity,
  pickFleetCargoCapacityLimit,
  routeStopsWithinVehicleCapacity,
} from "@/lib/logistics-route-capacity";

describe("logistics-route-capacity", () => {
  it("parses numeric capacity and validates stop count", () => {
    assert.equal(parseVehicleCargoCapacity("12 cajas"), 12);
    assert.equal(routeStopsWithinVehicleCapacity(10, "12 cajas"), true);
    assert.equal(routeStopsWithinVehicleCapacity(15, "12 cajas"), false);
    assert.equal(routeStopsWithinVehicleCapacity(99, ""), true);
  });

  it("picks the largest fleet cargo capacity limit", () => {
    assert.equal(
      pickFleetCargoCapacityLimit([
        { cargoCapacity: "8 cajas" },
        { cargoCapacity: "15" },
        { cargoCapacity: "" },
      ]),
      "15",
    );
    assert.equal(pickFleetCargoCapacityLimit([]), null);
  });
});
