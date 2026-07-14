import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const intake = readFileSync("src/components/warehouse/warehouse-intake-client.tsx", "utf8");
const warehouse = readFileSync("src/components/warehouse/warehouse-client.tsx", "utf8");
const pallets = readFileSync("src/components/warehouse/pallets-client.tsx", "utf8");
const shell = readFileSync("src/components/app-shell.tsx", "utf8");
const actions = readFileSync("src/app/actions/physical-packages.ts", "utf8");
const physicalPackages = readFileSync("src/lib/physical-packages.ts", "utf8");

test("warehouse surfaces keep compact disclosure and shared layout controls", () => {
  assert.match(intake, /showPending/);
  assert.match(intake, /showReceived/);
  assert.match(intake, /ViewLayoutToggle/);
  assert.match(intake, /returnPhysicalPackageToTruckAction/);
  assert.match(warehouse, /hidden=\{!showIntake\}/);
  assert.match(warehouse, /ViewLayoutToggle/);
  assert.match(pallets, /ViewLayoutToggle/);
  assert.match(pallets, /bg-emerald-400/);
  assert.match(shell, /flowStep: "01"/);
  assert.match(shell, /flowStep: "02"/);
  assert.match(shell, /flowStep: "03"/);
  assert.match(shell, /bg-emerald-400/);
  assert.match(shell, /Flujo de bodega/);
});

test("warehouse source keeps operational copy in valid UTF-8", () => {
  for (const source of [intake, warehouse, pallets, actions, physicalPackages]) {
    assert.doesNotMatch(source, /[ÃÂâ]/);
  }

  assert.match(actions, /No encontramos una caja con ese código\./);
  assert.match(actions, /La paleta está cerrada\./);
  assert.match(warehouse, /Camiones y recepción física/);
  assert.match(warehouse, /Contenido — una línea: descripción \| cantidad \| valor/);
  assert.match(physicalPackages, /Agrega al menos un artículo con cantidad\./);
});
