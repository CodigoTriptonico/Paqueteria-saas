import assert from "node:assert/strict";
import test from "node:test";
import {
  parsePackageContents,
  physicalPackageCodesForShipment,
  physicalPackageCountFromPlan,
  physicalPackageCode,
  physicalPackageStatusLabel,
  validatePackageContents,
} from "./physical-packages";

test("physical package code keeps one stable code per box", () => {
  assert.equal(physicalPackageCode("INV-001", 0), "INV-001-01");
  assert.equal(physicalPackageCode("INV-001", 11), "INV-001-12");
});

test("physical packages are created for every box sold and fall back to one box", () => {
  assert.equal(
    physicalPackageCountFromPlan({ boxLines: [{ label: "Caja chica", quantity: 2 }, { label: "Caja grande", quantity: 3 }] }),
    5,
  );
  assert.deepEqual(physicalPackageCodesForShipment("INV-009", {}), ["INV-009-01"]);
  assert.deepEqual(physicalPackageCodesForShipment("INV-009", { box: { label: "Caja chica" }, boxCount: 2 }), [
    "INV-009-01",
    "INV-009-02",
  ]);
});

test("physical packages only retain valid content lines", () => {
  assert.deepEqual(
    parsePackageContents([
      { description: "Ropa", quantity: 2, declaredValue: 20 },
      { description: "", quantity: 1, declaredValue: 5 },
      { description: "Invalida", quantity: 0, declaredValue: 5 },
    ]),
    [{ description: "Ropa", quantity: 2, declaredValue: 20 }],
  );
  assert.equal(physicalPackageStatusLabel.in_truck, "En camión");
});

test("physical package validation returns readable UTF-8 errors", () => {
  assert.deepEqual(validatePackageContents([]), {
    ok: false,
    error: "Agrega al menos un artículo con cantidad.",
  });
});
