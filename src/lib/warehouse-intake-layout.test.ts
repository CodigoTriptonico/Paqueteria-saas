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

test("intake keeps explanatory copy behind compact help controls", () => {
  assert.match(intake, /function IntakeInfoDisclosure/);
  assert.match(intake, /ariaLabel="Ver ayuda de apertura de ingreso"/);
  assert.match(intake, /ariaLabel="Ver por qué no hay camiones"/);
  assert.match(intake, /ariaLabel="Ver ayuda para caja encontrada"/);
  assert.match(intake, /fixed inset-x-4 top-1\/2/);
  assert.match(intake, /min-h-16 items-center justify-center/);
});
