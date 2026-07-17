import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const shell = readFileSync(join(root, "src/components/app-shell.tsx"), "utf8");
const permissions = readFileSync(join(root, "src/lib/auth/permissions.ts"), "utf8");

describe("business navigation eval", () => {
  it("uses Agencia in canonical navigation and exposes the new work areas", () => {
    assert.match(shell, /Mi agencia/);
    assert.match(shell, /Red de agencias/);
    assert.match(shell, /Solicitudes/);
    assert.match(shell, /Contabilidad/);
    assert.doesNotMatch(shell, /label: "Mi distribuidora"/);
  });

  it("keeps agency, finance and operations permissions separated", () => {
    assert.match(permissions, /administrador_agencia/);
    assert.match(permissions, /supervisor_agencias/);
    assert.match(permissions, /accounting\.reconcile/);
    assert.match(permissions, /agency\.requests\.assign/);
    assert.match(permissions, /financial_hold\.release/);
  });
});
