import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const action = readFileSync(join(root, "src/app/actions/platform.ts"), "utf8");
const ui = readFileSync(join(root, "src/components/platform/platform-console.tsx"), "utf8");

describe("platform archive compatibility eval", () => {
  it("preserves business users and organizations instead of hard deleting them", () => {
    assert.match(action, /archive_business_organization/);
    assert.match(action, /archived_at/);
    assert.doesNotMatch(action, /auth\.admin\.deleteUser/);
    assert.doesNotMatch(action, /from\("organizations"\)\s*\.delete/);
    assert.match(ui, /Cerrar y archivar/);
    assert.match(ui, /historial se conservó/);
  });
});
