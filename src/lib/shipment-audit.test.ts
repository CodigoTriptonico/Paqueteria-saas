import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { describeLogisticsAuditChange, describeStatusAuditChange, shipmentAuditActionLabel } from "./shipment-audit";

describe("shipment-audit", () => {
  it("describes status changes with interaction and step", () => {
    const description = describeStatusAuditChange({
      previousStatus: "Pendiente",
      nextStatus: "En oficina",
      interaction: "left_click",
      stepTitle: "En oficina",
    });

    assert.match(description, /Clic izquierdo/i);
    assert.match(description, /Pendiente → En oficina/);
    assert.match(description, /Paso: En oficina/);
  });

  it("describes logistics changes with before and after legs", () => {
    const description = describeLogisticsAuditChange({
      interaction: "context_menu",
      stepTitle: "Recolección de caja llena",
      before: {
        fullBox: {
          mode: "Cliente trae caja llena a oficina",
        },
      },
      after: {
        fullBox: {
          mode: "Programar recoleccion caja llena",
          scheduleMode: "pending",
        },
      },
    });

    assert.match(description, /Menú contextual/i);
    assert.match(description, /Oficina → Domicilio/i);
  });

  it("labels milestone audit events", () => {
    assert.equal(shipmentAuditActionLabel("shipment.milestone_recorded"), "Hito del envío");
  });
});
