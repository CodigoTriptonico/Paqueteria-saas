import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const intake = readFileSync("src/components/warehouse/warehouse-intake-client.tsx", "utf8");
const warehouse = readFileSync("src/components/warehouse/warehouse-client.tsx", "utf8");
const pallets = readFileSync("src/components/warehouse/pallets-client.tsx", "utf8");
const shell = readFileSync("src/components/app-shell.tsx", "utf8");
const actions = readFileSync("src/app/actions/physical-packages.ts", "utf8");
const intakeActions = readFileSync("src/app/actions/warehouse-intake.ts", "utf8");
const physicalPackages = readFileSync("src/lib/physical-packages.ts", "utf8");

test("warehouse surfaces keep compact disclosure and shared sidebar layout controls", () => {
  assert.match(intake, /usePageViewLayout\("warehouse\.intake"\)/);
  assert.doesNotMatch(intake, /ViewLayoutToggle/);
  assert.match(intake, /setDrawer\("pending"\)/);
  assert.match(intake, /setDrawer\("received"\)/);
  assert.match(intake, /setDrawer\("differences"\)/);
  assert.match(intake, /role="alert"/);
  assert.match(intake, /Intentar otra vez/);
  assert.match(warehouse, /hidden=\{!showIntake\}/);
  assert.match(warehouse, /usePageViewLayout\("warehouse\.inventory"\)/);
  assert.match(pallets, /usePageViewLayout\("warehouse\.pallets"\)/);
  assert.doesNotMatch(warehouse, /ViewLayoutToggle/);
  assert.doesNotMatch(pallets, /ViewLayoutToggle/);
  assert.match(pallets, /bg-emerald-400/);
  assert.match(shell, /flowStep: "01"/);
  assert.match(shell, /flowStep: "02"/);
  assert.match(shell, /flowStep: "03"/);
  assert.match(shell, /bg-emerald-400/);
  assert.match(shell, /Flujo de bodega/);
});

test("warehouse intake uses the available work area on desktop", () => {
  assert.match(intake, /useSetShellConfig/);
  assert.match(intake, /setShellConfig\(\{ contentEdgeToEdge: true \}\)/);
  assert.match(intake, /className="w-full max-w-none"/);
  assert.doesNotMatch(intake, /mx-auto max-w-[56]xl/);
});

test("warehouse intake keeps truck choice compact and scanner-ready", () => {
  assert.match(intake, /function IntakeInfoDisclosure/);
  assert.match(intake, /ariaLabel="Ver por qué no hay camiones"/);
  assert.match(intake, /const \[truckPickerOpen, setTruckPickerOpen\] = useState\(false\)/);
  assert.match(intake, /const \[pendingScanCode, setPendingScanCode\] = useState\(""\)/);
  assert.match(intake, /function beginInitialScan\(\)/);
  assert.match(intake, /aria-label="Escanear caja sin ingreso abierto"/);
  assert.match(intake, /Abrir y escanear/);
  assert.match(intake, /aria-labelledby="warehouse-truck-picker-title"/);
  assert.match(intake, /divide-y divide-black/);
  assert.doesNotMatch(intake, /mt-4 grid gap-2 sm:grid-cols-2/);
  assert.match(intake, /placeholder="Escanea o escribe el código"/);
  assert.match(intake, /const \[foundOpen, setFoundOpen\] = useState\(false\)/);
  assert.match(intake, /aria-labelledby="warehouse-found-title"/);
  assert.match(intake, />Caja encontrada<\/button>/);
  assert.doesNotMatch(intake, /Custodia de bodega/);
  assert.doesNotMatch(intake, />Abrir ingreso</);
});

test("warehouse source keeps operational copy in valid UTF-8", () => {
  for (const source of [intake, warehouse, pallets, actions, intakeActions, physicalPackages]) {
    assert.doesNotMatch(source, /[ÃÂâ]/);
  }

  assert.match(intakeActions, /No encontramos una caja con ese código\./);
  assert.match(actions, /La paleta está cerrada\./);
  assert.match(warehouse, /Camiones y recepción física/);
  assert.match(warehouse, /Contenido — una línea: descripción \| cantidad \| valor/);
  assert.match(physicalPackages, /Agrega al menos un artículo con cantidad\./);
});
