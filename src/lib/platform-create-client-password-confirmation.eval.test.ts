import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/platform/platform-create-client-wizard.tsx"),
  "utf8",
);

describe("platform client password confirmation eval", () => {
  it("requires a matching confirmation before creating the initial administrator", () => {
    assert.match(source, /adminPasswordConfirmation/);
    assert.match(source, /Confirmar contrase\u00f1a/);
    assert.match(source, /passwordConfirmationMessage\(\s*form\.adminPassword,\s*form\.adminPasswordConfirmation,?\s*\)/);
    assert.match(source, /disabled=\{submitting \|\| showPasswordConfirmationError\}/);
    assert.match(source, /name="client_admin_password_confirmation"/);
  });
});
