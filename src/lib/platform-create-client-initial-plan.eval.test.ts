import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/platform/platform-create-client-wizard.tsx"),
  "utf8",
);

describe("platform client initial plan eval", () => {
  it("shows the team capacity by role and uses the same six-seat total when creating the organization", () => {
    assert.match(source, /initialAdditionalUserLimit/);
    assert.match(source, /initialTeamPlan\.map/);
    assert.match(source, /Equipo incluido/);
    assert.match(source, /\{initialAdditionalUserLimit\} espacios además del dueño/);
    assert.match(source, /maxUsers: initialAdditionalUserLimit/);
  });

  it("offers the exclusive agency module disabled by default", () => {
    assert.match(source, /agenciesEnabled: false/);
    assert.match(source, /role="switch"/);
    assert.match(source, /Módulo Agencias/);
    assert.match(source, /Desactivado por defecto/);
  });

  it("stacks the compact password fields and keeps the generator outside them", () => {
    assert.match(source, /const passwordFieldsClass = `max-w-\[34rem\] space-y-3/);
    assert.match(source, /const passwordGeneratorButtonClass =/);
    assert.match(source, /Acceso inicial/);
    assert.doesNotMatch(source, /grid gap-3 lg:grid-cols-2/);
  });
});
