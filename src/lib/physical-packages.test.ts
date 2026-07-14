import assert from "node:assert/strict";
import test from "node:test";
import {
  parsePackageContents,
  physicalPackageCode,
  physicalPackageStatusLabel,
  validatePackageContents,
} from "./physical-packages";

test("physical package code keeps one stable code per box", () => {
  assert.equal(physicalPackageCode("INV-001", 0), "INV-001-01");
  assert.equal(physicalPackageCode("INV-001", 11), "INV-001-12");
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
