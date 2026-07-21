import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const intake = readFileSync("src/components/warehouse/warehouse-intake-client.tsx", "utf8");

test("intake workspace does not constrain the operational screen width", () => {
  const fullWidthSections = intake.match(/className="w-full max-w-none"/g) ?? [];

  assert.equal(fullWidthSections.length, 2);
  assert.match(intake, /setShellConfig\(\{ contentEdgeToEdge: true \}\)/);
  assert.doesNotMatch(intake, /mx-auto max-w-[56]xl/);
});

test("intake keeps truck selection in a compact picker and the scanner in the work surface", () => {
  assert.match(intake, /function IntakeInfoDisclosure/);
  assert.match(intake, /ariaLabel="Ver por qué no hay camiones"/);
  assert.match(intake, /fixed inset-x-4 top-1\/2/);
  assert.match(intake, /const \[truckPickerOpen, setTruckPickerOpen\] = useState\(false\)/);
  assert.match(intake, /setTruckPickerOpen\(true\)/);
  assert.match(intake, /aria-labelledby="warehouse-truck-picker-title"/);
  assert.match(intake, /divide-y divide-black/);
  assert.doesNotMatch(intake, /mt-4 grid gap-2 sm:grid-cols-2/);
  assert.match(intake, /placeholder="Escanea o escribe el código"/);
  assert.match(intake, /const \[foundOpen, setFoundOpen\] = useState\(false\)/);
  assert.match(intake, /setFoundOpen\(true\)/);
  assert.match(intake, /aria-labelledby="warehouse-found-title"/);
  assert.match(intake, />Caja encontrada<\/button>/);
  assert.doesNotMatch(intake, /Custodia de bodega/);
  assert.doesNotMatch(intake, />Abrir ingreso</);
});
