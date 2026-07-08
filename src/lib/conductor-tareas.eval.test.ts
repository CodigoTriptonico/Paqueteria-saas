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
    assert.match(conductorPageSource, /listConductorTaskActivityHistoryAction/);
    assert.match(conductorPageSource, /initialTasks=/);
    assert.match(conductorPageSource, /initialHistory=/);
  });

  it("wires admin preview picker into the conductor tasks client", () => {
    assert.match(conductorClientSource, /Vista previa admin/);
    assert.match(conductorClientSource, /InlineSearchPicker/);
    assert.match(conductorClientSource, /params\.set\("conductor"/);
    assert.match(conductorClientSource, /conductorTaskTypeLabel/);
    assert.match(conductorViewSource, /canPreviewConductorTasks/);
    assert.match(conductorViewSource, /resolveConductorTasksView/);
  });

  it("shows sender address before box details on driver cards", () => {
    const senderIndex = conductorClientSource.indexOf("task.customerName");
    const addressIndex = conductorClientSource.indexOf("task.addressLine");
    const boxIndex = conductorClientSource.indexOf("task.boxSummary");

    assert.ok(senderIndex >= 0);
    assert.ok(addressIndex > senderIndex);
    assert.ok(boxIndex > addressIndex);
    assert.doesNotMatch(conductorClientSource, /Destinatario/);
    assert.doesNotMatch(conductorClientSource, /CountryName/);
    assert.doesNotMatch(conductorClientSource, /task\.country/);
  });

  it("loads conductor task history and renders audit entries", () => {
    assert.match(conductorClientSource, /initialHistory/);
    assert.match(conductorClientSource, /AuditHistoryEntry/);
    assert.match(conductorClientSource, /Historial/);
    assert.match(conductorClientSource, /listConductorTaskActivityHistoryAction/);
  });

  it("opens history after marking no se pudo", () => {
    assert.match(conductorClientSource, /setHistoryOpen\(true\)/);
    assert.match(conductorClientSource, /dialog\.result === "failed"/);
  });
});
