import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const shell = readFileSync(join(root, "src/components/app-shell.tsx"), "utf8");
const frame = readFileSync(join(root, "src/components/app-frame.tsx"), "utf8");
const commandCenter = readFileSync(join(root, "src/components/business/business-command-center.tsx"), "utf8");
const permissions = readFileSync(join(root, "src/lib/auth/permissions.ts"), "utf8");

describe("business navigation eval", () => {
  it("keeps every agency workspace under one navigation section", () => {
    assert.match(shell, /\{ label: "Mi agencia", href: "\/agencia", icon: Building2, section: "agencies" \}/);
    assert.match(shell, /\{ label: "Agencias a mi cargo", href: "\/captacion", icon: Users, section: "agencies" \}/);
    assert.match(shell, /Vendedores y agencias/);
    assert.match(shell, /Solicitudes/);
    assert.match(shell, /Contabilidad/);
    assert.doesNotMatch(shell, /\{ label: "Mi agencia", href: "\/agencia", icon: Building2, section: "main" \}/);
    assert.doesNotMatch(shell, /label: "Mis agencias"/);
    assert.doesNotMatch(shell, /label: "Mi distribuidora"/);
    assert.match(frame, /return "Agencias a mi cargo"/);
    assert.doesNotMatch(commandCenter, /href="\/venta">Crear venta/);
    assert.doesNotMatch(commandCenter, /href="\/solicitudes">Nueva solicitud/);
    assert.ok(shell.indexOf('href: "/agencia"') < shell.indexOf('href: "/captacion"'));
  });

  it("keeps agency, finance and operations permissions separated", () => {
    assert.doesNotMatch(permissions, /ROLE_ROUTE_ACCESS/);
    assert.match(permissions, /agency\.daily_close\.finalize/);
    assert.match(permissions, /accounting\.reconcile/);
    assert.match(permissions, /agency\.requests\.assign/);
    assert.match(permissions, /financial_hold\.release/);
  });
});
