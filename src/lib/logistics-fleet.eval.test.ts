import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  logisticsDriverRouteOption,
  moveVehicleDriverAssignment,
  type LogisticsDriverRow,
  type LogisticsVehicleRow,
} from "./logistics-fleet";

describe("logistics fleet eval", () => {
  it("created drivers appear as route options", () => {
    const driver: LogisticsDriverRow = {
      id: "driver-1",
      email: "chofer@boxario.local",
      fullName: "Carlos Ruta",
      phone: "",
      isActive: true,
      createdAt: "2026-07-03T00:00:00.000Z",
      vehicleId: null,
      vehicleName: "",
      vehiclePlate: "",
    };

    assert.deepEqual(logisticsDriverRouteOption(driver), {
      id: "driver-1",
      label: "Carlos Ruta",
      roleSlug: "conductor",
    });
  });

  it("shows assigned vehicle with the right driver", () => {
    const vehicle: LogisticsVehicleRow = {
      id: "truck-1",
      name: "Ford Transit",
      plate: "ABC-123",
      photoUrl: "",
      cargoBoxSize: "8 pies",
      cargoCapacity: "1200 lb",
      notes: "",
      assignedDriverId: "driver-1",
      assignedDriverName: "Carlos Ruta",
      assignedDriverEmail: "chofer@boxario.local",
      isActive: true,
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: "2026-07-03T00:00:00.000Z",
    };

    assert.equal(vehicle.assignedDriverName, "Carlos Ruta");
    assert.equal(vehicle.assignedDriverId, "driver-1");
  });

  it("reassigning a driver clears the previous active vehicle", () => {
    const result = moveVehicleDriverAssignment(
      [
        { id: "truck-a", assignedDriverId: "driver-1", isActive: true },
        { id: "truck-b", assignedDriverId: null, isActive: true },
        { id: "historic", assignedDriverId: "driver-1", isActive: false },
      ],
      "truck-b",
      "driver-1",
    );

    assert.equal(result.find((entry) => entry.id === "truck-a")?.assignedDriverId, null);
    assert.equal(result.find((entry) => entry.id === "truck-b")?.assignedDriverId, "driver-1");
    assert.equal(result.find((entry) => entry.id === "historic")?.assignedDriverId, "driver-1");
  });
});
