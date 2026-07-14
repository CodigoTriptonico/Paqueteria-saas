import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const workspace = fs.readFileSync(path.resolve(process.cwd(), "src/components/distribution/distribution-workspace.tsx"), "utf8");
const actions = fs.readFileSync(path.resolve(process.cwd(), "src/app/actions/distribution.ts"), "utf8");

test("matrix console exposes the full distributor control surface", () => {
  for (const label of ["Resumen", "Productos", "Cuenta", "Operación", "Acceso", "Exportar CSV", "Pausar distribuidor"]) {
    assert.match(workspace, new RegExp(label));
  }
  for (const action of [
    "updateDistributionPartnerAction",
    "updateDistributionCreditLimitAction",
    "setDistributionPartnerStatusAction",
    "resetDistributionPartnerPasswordAction",
    "exportDistributionLedgerAction",
  ]) {
    assert.match(actions, new RegExp(`export async function ${action}`));
  }
});

test("matrix money language remains internal, not public receivable", () => {
  assert.match(workspace, /precio público se monitorea, pero no entra en tu cuenta por cobrar/i);
  assert.match(workspace, /tarifa interna/i);
});
