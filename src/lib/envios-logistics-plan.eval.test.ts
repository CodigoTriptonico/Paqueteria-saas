import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const enviosSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/envios-client.tsx"),
  "utf8",
);
const badgesSource = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../components/shipment-logistics-assignment-badges.tsx",
  ),
  "utf8",
);
const displaySource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "shipment-display.ts"),
  "utf8",
);
const progressSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/shipment-progress-steps.tsx"),
  "utf8",
);

describe("envios logistics plan eval", () => {
  it("shows route and driver assignment beside priority on shipment cards", () => {
    assert.equal(enviosSource.includes("shipmentOperationalAssignment"), true);
    assert.equal(enviosSource.includes("routeMemberLabelById"), true);
    assert.equal(enviosSource.includes("routeByTaskId"), true);
    assert.equal(enviosSource.includes("<ShipmentLogisticsAssignmentBadges"), true);
    assert.equal(enviosSource.includes("assignment={logisticsAssignment}"), true);
    assert.equal(enviosSource.includes("shipmentLogisticsBridgeLabel"), true);
    assert.equal(enviosSource.includes("logisticsBridgeLabel"), true);
    assert.equal(enviosSource.includes("activeStep"), true);
    assert.equal(displaySource.includes("driverTaskOrdered !== true"), true);
    assert.equal(displaySource.includes("SHIPMENT_LOGISTICS_BRIDGE_LABEL"), true);
    assert.equal(displaySource.includes("Avisado a logística"), true);
    assert.equal(enviosSource.includes("logisticsAssignmentLabel={logisticsAssignmentLabel}"), false);
    assert.equal(enviosSource.includes("{operationalStatus}"), false);
    assert.equal(enviosSource.includes("text-emerald-300/90"), false);
    assert.equal(enviosSource.includes("{logisticsAssignmentLabel || operationalStatus}"), false);
    assert.equal(badgesSource.includes("<Route"), true);
    assert.equal(badgesSource.includes("<UserRound"), true);
    assert.equal(badgesSource.includes("assignment.isReady"), true);
    assert.equal(progressSource.includes("stepIsReachable"), true);
    assert.equal(progressSource.includes("shipment-step-active-pulse"), true);
    assert.equal(progressSource.includes("splitLogisticsAssignmentLabel"), false);
    assert.equal(progressSource.includes("Acción:"), false);
  });

  it("does not show schedule dates instead of assignment", () => {
    assert.equal(displaySource.includes("Ruta asignada"), true);
    assert.equal(displaySource.includes("Ruta no asignada"), true);
    assert.equal(displaySource.includes("Conductor asignado"), true);
    assert.equal(displaySource.includes("Conductor no asignado"), true);
    assert.equal(displaySource.includes("isReady"), true);
    assert.equal(displaySource.includes("fullBoxPickupPlanStatus"), true);
    assert.equal(displaySource.includes("Recolección programada"), true);
  });
});
