import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertAssignableVehicleDriver,
  moveVehicleDriverAssignment,
  normalizeVehiclePlate,
  validateLogisticsVehicleInput,
} from "./logistics-fleet";

describe("logistics fleet", () => {
  it("normalizes vehicle plates", () => {
    assert.equal(normalizeVehiclePlate(" abc 123 "), "ABC-123");
    assert.equal(normalizeVehiclePlate("mx--44"), "MX-44");
  });

  it("validates required vehicle fields", () => {
    assert.equal(
      validateLogisticsVehicleInput({
        name: "",
        plate: "ABC123",
        cargoBoxSize: "8 pies",
        cargoCapacity: "1200 lb",
      }).ok,
      false,
    );
    assert.equal(
      validateLogisticsVehicleInput({
        name: "Ford Transit",
        plate: "",
        cargoBoxSize: "8 pies",
        cargoCapacity: "1200 lb",
      }).ok,
      false,
    );
    assert.equal(
      validateLogisticsVehicleInput({
        name: "Ford Transit",
        plate: "ABC123",
        cargoBoxSize: "8 pies",
        cargoCapacity: "1200 lb",
      }).ok,
      true,
    );
  });

  it("rejects assignment to inactive or non-driver users", () => {
    const drivers = [
      { id: "driver-1", roleSlug: "conductor", isActive: true },
      { id: "seller-1", roleSlug: "vendedor", isActive: true },
      { id: "driver-2", roleSlug: "conductor", isActive: false },
    ];

    assert.doesNotThrow(() => assertAssignableVehicleDriver("driver-1", drivers));
    assert.throws(() => assertAssignableVehicleDriver("seller-1", drivers), /Conductor no valido/);
    assert.throws(() => assertAssignableVehicleDriver("driver-2", drivers), /Conductor no valido/);
  });

  it("soft delete keeps inactive rows available for history filters", () => {
    const rows = [
      { id: "truck-1", assignedDriverId: "driver-1", isActive: false },
      { id: "truck-2", assignedDriverId: null, isActive: true },
    ];

    assert.deepEqual(rows.filter((row) => row.isActive).map((row) => row.id), ["truck-2"]);
    assert.equal(rows.find((row) => row.id === "truck-1")?.assignedDriverId, "driver-1");
  });

  it("moves a driver from the previous active vehicle", () => {
    const moved = moveVehicleDriverAssignment(
      [
        { id: "truck-1", assignedDriverId: "driver-1", isActive: true },
        { id: "truck-2", assignedDriverId: null, isActive: true },
      ],
      "truck-2",
      "driver-1",
    );

    assert.deepEqual(moved, [
      { id: "truck-1", assignedDriverId: null, isActive: true },
      { id: "truck-2", assignedDriverId: "driver-1", isActive: true },
    ]);
  });
});
