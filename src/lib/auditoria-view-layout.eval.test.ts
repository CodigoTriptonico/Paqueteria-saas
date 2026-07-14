import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "components/estadisticas/auditoria-panel.tsx"), "utf8");

describe("auditoria view layout eval", () => {
  it("wires the shared view layout toggle in auditoria", () => {
    assert.equal(source.includes("useViewLayout"), true);
    assert.equal(source.includes("ViewLayoutToggle"), true);
    assert.equal(source.includes("toggleViewLayout"), true);
  });

  it("switches shipment picker between rows and cards", () => {
    assert.equal(source.includes('viewLayout === "rows"'), true);
    assert.equal(source.includes("grid-cols-2"), true);
  });
});
