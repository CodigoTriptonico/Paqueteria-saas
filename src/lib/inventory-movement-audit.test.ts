import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultReasonCodeForMovementType,
  formatInventoryMovementReference,
  formatInventoryMovementTrail,
  movementReasonRequiresDetail,
  readInventoryMovementEvidencePhotos,
} from "./inventory-movement-audit";

describe("inventory-movement-audit", () => {
  it("maps manual movement types to default reason codes", () => {
    assert.equal(defaultReasonCodeForMovementType("entrada"), "manual_entry");
    assert.equal(defaultReasonCodeForMovementType("salida"), "manual_exit");
    assert.equal(defaultReasonCodeForMovementType("ajuste"), "physical_count");
  });

  it("requires detail for physical count and other", () => {
    assert.equal(movementReasonRequiresDetail("physical_count"), true);
    assert.equal(movementReasonRequiresDetail("other"), true);
    assert.equal(movementReasonRequiresDetail("manual_entry"), false);
  });

  it("formats origin destination trail", () => {
    assert.equal(
      formatInventoryMovementTrail({
        fromLabel: "Bodega central",
        toLabel: "Juan Pérez",
      }),
      "Bodega central → Juan Pérez",
    );
    assert.equal(formatInventoryMovementTrail({ toLabel: "Envío SCG-1" }), "→ Envío SCG-1");
  });

  it("reads evidence photo urls", () => {
    assert.deepEqual(
      readInventoryMovementEvidencePhotos({
        photos: ["https://example.com/a.jpg", "", 2],
      }),
      ["https://example.com/a.jpg"],
    );
  });

  it("formats document reference labels", () => {
    assert.equal(
      formatInventoryMovementReference({
        referenceType: "shipment",
        referenceId: "abc",
        referenceLabel: "SCG-1042",
      }),
      "Envío: SCG-1042",
    );
  });
});
