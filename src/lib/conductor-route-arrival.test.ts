import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  routeIsReadyForArrival,
  validateConductorRouteArrival,
} from "@/lib/conductor-route-arrival";

describe("conductor route arrival", () => {
  it("only offers arrival after every stop has a terminal result", () => {
    assert.equal(routeIsReadyForArrival({ status: "in_progress", stopOutcomes: ["completed", "failed"] }), true);
    assert.equal(routeIsReadyForArrival({ status: "in_progress", stopOutcomes: ["completed", null] }), false);
    assert.equal(routeIsReadyForArrival({ status: "planned", stopOutcomes: ["completed"] }), false);
    assert.equal(routeIsReadyForArrival({ status: "in_progress", stopOutcomes: [] }), false);
  });

  it("requires a warehouse and an understandable reason", () => {
    assert.deepEqual(
      validateConductorRouteArrival({ warehouseId: "", reason: "completed_normally", note: "", hasExceptions: false }),
      { ok: false, error: "Toca la bodega donde dejaste las cajas." },
    );
    assert.deepEqual(
      validateConductorRouteArrival({ warehouseId: "warehouse-1", reason: "", note: "", hasExceptions: false }),
      { ok: false, error: "Toca una razón para terminar la ruta." },
    );
  });

  it("does not allow a normal ending when a stop failed", () => {
    const result = validateConductorRouteArrival({
      warehouseId: "warehouse-1",
      reason: "completed_normally",
      note: "",
      hasExceptions: true,
    });
    assert.equal(result.ok, false);
  });

  it("only asks for writing when the driver chooses another reason", () => {
    assert.equal(validateConductorRouteArrival({
      warehouseId: "warehouse-1",
      reason: "vehicle_problem",
      note: "",
      hasExceptions: false,
    }).ok, true);
    assert.equal(validateConductorRouteArrival({
      warehouseId: "warehouse-1",
      reason: "other",
      note: "",
      hasExceptions: false,
    }).ok, false);
    assert.equal(validateConductorRouteArrival({
      warehouseId: "warehouse-1",
      reason: "other",
      note: "Lluvia fuerte",
      hasExceptions: false,
    }).ok, true);
  });
});
