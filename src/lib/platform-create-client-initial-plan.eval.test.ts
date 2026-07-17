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

  it("keeps both password inputs compact on wide screens", () => {
    assert.match(source, /lg:grid-cols-2/);
    assert.match(source, /max-w-\[34rem\]/);
  });
});
