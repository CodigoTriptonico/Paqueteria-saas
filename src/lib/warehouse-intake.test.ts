import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWarehouseIntakeSummary,
  canScanWarehouseIntake,
  defaultIntakeLocation,
  validateWarehouseIntakeDraft,
  warehouseIntakeCloseStatus,
  warehouseIntakeHasExceptions,
  warehouseIntakeNeedsDriverConfirmation,
} from "./warehouse-intake";

test("warehouse intake reconciles expected, missing, unexpected and damaged boxes", () => {
  const summary = buildWarehouseIntakeSummary({
    expected: 4,
    items: [
      { matchStatus: "expected", condition: "correct", weightOutOfTolerance: false, locationLabel: "Recepción pendiente" },
      { matchStatus: "expected", condition: "wet", weightOutOfTolerance: false, locationLabel: "Cuarentena" },
      { matchStatus: "unexpected", condition: "correct", weightOutOfTolerance: true, locationLabel: "Cuarentena" },
      { matchStatus: "unidentified", condition: "unidentified", locationLabel: "Cuarentena" },
    ],
  });

  assert.deepEqual(summary, {
    expected: 4,
    received: 4,
    missing: 2,
    unexpected: 1,
    damaged: 1,
    unidentified: 1,
    weightDifferences: 1,
    quarantine: 3,
  });
  assert.equal(warehouseIntakeHasExceptions(summary), true);
});

test("closed intakes reject more scans and keep an explicit close result", () => {
  const clean = buildWarehouseIntakeSummary({
    expected: 1,
    items: [{ matchStatus: "expected", condition: "correct", weightOutOfTolerance: false, locationLabel: "Recepción pendiente" }],
  });
  assert.equal(canScanWarehouseIntake("unloading"), true);
  assert.equal(canScanWarehouseIntake("in_review"), true);
  assert.equal(canScanWarehouseIntake("completed"), false);
  assert.equal(canScanWarehouseIntake("completed_with_exceptions"), false);
  assert.equal(warehouseIntakeCloseStatus(clean), "completed");
  assert.equal(warehouseIntakeCloseStatus({ ...clean, missing: 1 }), "completed_with_exceptions");
});

test("damaged and unidentified boxes require note and photo", () => {
  assert.equal(defaultIntakeLocation("correct"), "Recepción pendiente");
  assert.equal(defaultIntakeLocation("broken"), "Cuarentena");
  assert.deepEqual(validateWarehouseIntakeDraft({
    code: "BX-10",
    condition: "broken",
    weightKg: 3,
    note: "Esquina rota",
    hasEvidence: false,
    isKnownPackage: true,
  }), { ok: false, error: "Toma una foto antes de confirmar la excepción." });
  assert.deepEqual(validateWarehouseIntakeDraft({
    code: "DESCONOCIDA",
    condition: "unidentified",
    weightKg: null,
    note: "Sin etiqueta",
    hasEvidence: true,
    isKnownPackage: false,
  }), { ok: true });
});

test("known boxes require a positive received weight", () => {
  assert.deepEqual(validateWarehouseIntakeDraft({
    code: "BX-11",
    condition: "correct",
    weightKg: 0,
    note: "",
    hasEvidence: false,
    isKnownPackage: true,
  }), { ok: false, error: "Indica el peso recibido en kg." });
});

test("found warehouse intake closes without inventing a driver", () => {
  assert.equal(warehouseIntakeNeedsDriverConfirmation("truck_manifest"), true);
  assert.equal(warehouseIntakeNeedsDriverConfirmation("found_in_warehouse"), false);
});
