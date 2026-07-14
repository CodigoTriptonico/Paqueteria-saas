import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const appShellSource = readFileSync(join(root, "components/app-shell.tsx"), "utf8");
const appFrameSource = readFileSync(join(root, "components/app-frame.tsx"), "utf8");
const permissionsSource = readFileSync(join(root, "lib/auth/permissions.ts"), "utf8");
const conductorPageSource = readFileSync(join(root, "app/conductor/tareas/page.tsx"), "utf8");
const conductorClientSource = readFileSync(
  join(root, "components/conductor/conductor-tareas-client.tsx"),
  "utf8",
);
const conductorViewSource = readFileSync(join(root, "lib/conductor-tareas-view.ts"), "utf8");
const conductorActionsSource = readFileSync(join(root, "app/actions/conductor-tasks.ts"), "utf8");

describe("conductor tareas shell eval", () => {
  it("registers tareas conductor nav item", () => {
    assert.match(appShellSource, /label: "Tareas conductor"/);
    assert.match(appShellSource, /href: "\/conductor\/tareas"/);
    assert.doesNotMatch(appShellSource, /conductorOnly: true/);
  });

  it("maps conductor routes to the shell active label", () => {
    assert.match(appFrameSource, /pathname\.startsWith\("\/conductor"\)/);
    assert.match(appFrameSource, /conductorTasksNavLabel/);
  });

  it("grants conductor role access to /conductor paths without envios", () => {
    assert.match(permissionsSource, /conductor: \["\/", "\/conductor"\]/);
    assert.doesNotMatch(permissionsSource, /conductor: \["\/", "\/envios", "\/conductor"\]/);
    assert.match(
      permissionsSource,
      /administrador: \[.*"\/conductor"\]/,
    );
    assert.match(permissionsSource, /"\/conductor": \["routes\.view"\]/);
  });

  it("renders the conductor tasks page through the client shell", () => {
    assert.match(conductorPageSource, /ConductorTareasClient/);
    assert.match(conductorPageSource, /requirePathAccess\("\/conductor\/tareas"\)/);
    assert.match(conductorPageSource, /resolveConductorTasksView/);
    assert.match(conductorPageSource, /listConductorDriverTasksAction/);
    assert.match(conductorPageSource, /listConductorClosedDriverTasksAction/);
    assert.match(conductorPageSource, /initialTasks=/);
    assert.match(conductorPageSource, /initialCompletedTasks=/);
  });

  it("wires admin preview picker into the conductor tasks client", () => {
    assert.match(conductorClientSource, /Vista admin/);
    assert.match(conductorClientSource, /InlineSearchPicker/);
    assert.match(conductorClientSource, /params\.set\("conductor"/);
    assert.doesNotMatch(conductorClientSource, /conductorTaskTypeLabel/);
    assert.match(conductorViewSource, /canPreviewConductorTasks/);
    assert.match(conductorViewSource, /resolveConductorTasksView/);
  });

  it("shows sender address before box details on driver cards", () => {
    const senderIndex = conductorClientSource.indexOf("task.senderName");
    const addressIndex = conductorClientSource.indexOf("task.addressLine");
    const boxIndex = conductorClientSource.indexOf("task.boxSummary");

    assert.ok(senderIndex >= 0);
    assert.ok(addressIndex > senderIndex);
    assert.ok(boxIndex > addressIndex);
    assert.match(conductorClientSource, /ConductorTaskRecipientPeek/);
    assert.match(conductorClientSource, /Remitente/);
    assert.doesNotMatch(conductorClientSource, /CountryName/);
    assert.doesNotMatch(conductorClientSource, /task\.country/);
  });

  it("keeps the route result summary visible alongside the dedicated completed view", () => {
    assert.match(conductorClientSource, /Faltan/);
    assert.match(conductorClientSource, /Listas/);
    assert.match(conductorClientSource, /No se pudo/);
    assert.match(conductorClientSource, /Resueltas/);
    assert.match(conductorClientSource, /listMode === "completed"/);
    assert.match(conductorClientSource, /conductorTaskOutcomeLabel/);
    assert.doesNotMatch(conductorClientSource, /Historial/);
  });

  it("keeps the driver task controls in compact operational bars", () => {
    assert.match(conductorClientSource, /min-h-10 flex-wrap items-center/);
    assert.match(conductorClientSource, /flex flex-wrap items-center gap-1\.5/);
    assert.match(conductorClientSource, /className="flex h-9 min-w-0 overflow-hidden rounded-md border border-black" role="group"/);
    assert.match(conductorClientSource, /className="flex h-9 min-w-0 overflow-hidden rounded-md border border-black bg-surface-inset" role="tablist"/);
    assert.doesNotMatch(conductorClientSource, /min-h-14/);
  });

  it("keeps the chosen box filter when switching task lists", () => {
    assert.match(conductorClientSource, /function handleListModeChange\(next: TaskListMode\)/);
    assert.match(conductorClientSource, /setListMode\(next\)/);
    assert.doesNotMatch(conductorClientSource, /setTaskFilter\(defaultTaskFilter/);
  });

  it("does not hide driver tasks when vehicle metadata is unavailable", () => {
    assert.match(conductorActionsSource, /vehicles: vehiclesResult\.ok \? vehiclesResult\.data : \[\]/);
    assert.doesNotMatch(conductorActionsSource, /if \(!vehiclesResult\.ok\) \{\s*throw new Error\(vehiclesResult\.error\);/);
  });

  it("opens completed view after marking no se pudo", () => {
    assert.match(conductorClientSource, /setCompletedTasks/);
    assert.match(conductorClientSource, /dialog\.result === "failed"/);
  });

  it("lets drivers reactivate failed visits from completed view", () => {
    assert.match(conductorActionsSource, /export async function reactivateConductorTaskAction/);
    assert.match(conductorClientSource, /reactivateConductorTaskAction/);
    assert.match(conductorClientSource, /Volver al listado/);
    assert.match(conductorClientSource, /task\.status === "cancelled"/);
  });
});
