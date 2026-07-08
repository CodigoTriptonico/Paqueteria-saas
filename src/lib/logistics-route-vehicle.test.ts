import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  suggestVehicleIdForDriver,
  vehicleDisplayLabel,
} from "@/lib/logistics-route-vehicle";

describe("logistics-route-vehicle", () => {
  it("suggests active vehicle assigned to driver", () => {
    const vehicleId = suggestVehicleIdForDriver(
      [
        { id: "v1", assignedDriverId: "d1", isActive: true },
        { id: "v2", assignedDriverId: "d2", isActive: true },
      ],
      "d1",
    );

    assert.equal(vehicleId, "v1");
    assert.equal(vehicleDisplayLabel({ name: "Camion 1", plate: "ABC123" }), "Camion 1 · ABC123");
  });
});
