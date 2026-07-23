import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function component(path: string) {
  return readFileSync(new URL(`../components/${path}`, import.meta.url), "utf8");
}

const distribution = component("distribution/distribution-workspace.tsx");
const collectDialog = component("shipment-collect-dialog.tsx");
const invoiceDialog = component("sale/sale-invoice-confirm-dialog.tsx");
const contactDialog = component("shipment-contact-log-dialog.tsx");
const platformWizard = component("platform/platform-create-client-wizard.tsx");
const planSettings = component("config/plan-settings-panel.tsx");
const warehouseAccess = component("config/user-warehouse-access-editor.tsx");
const driverChange = component("logistica/logistics-driver-change-dialog.tsx");
const uiStyle = readFileSync(new URL("../../UI-STYLE.md", import.meta.url), "utf8");

describe("visual density cleanup contract", () => {
  it("uses dividers instead of nested summary cards", () => {
    assert.match(collectDialog, /<dl className="[^"]*divide-y divide-black\/70 border-y border-black\/70/);
    assert.match(invoiceDialog, /<dl className="[^"]*divide-y divide-black\/70 border-y border-black\/70/);
    assert.doesNotMatch(collectDialog, /<dl className="[^"]*rounded-xl[^"]*bg-surface-card/);
    assert.doesNotMatch(invoiceDialog, /<dl className="[^"]*rounded-xl[^"]*bg-surface-card/);
    assert.match(contactDialog, /divide-y divide-black\/70/);
  });

  it("flattens form groups while preserving all controls", () => {
    assert.match(distribution, /<section className="space-y-4">/);
    assert.match(distribution, /border-t border-black\/70 pt-3/);
    assert.doesNotMatch(distribution, /<Panel title="Productos" hideHeader/);
    assert.doesNotMatch(distribution, /<Panel title="Cuenta" hideHeader/);
    assert.match(platformWizard, /const createOrgStepBodyClass\s*=\s*\n?\s*"w-full p-1 sm:p-2"/);
    assert.match(platformWizard, /const configBoxClass\s*=\s*\n?\s*"border-l border-emerald-400\/35 pl-4"/);
  });

  it("keeps critical and actionable information visible", () => {
    assert.match(distribution, /La reasignacion solo afecta ventas futuras/);
    assert.match(distribution, /No se elimina una cuenta con historial/);
    assert.match(planSettings, /¿Necesitas ampliar el plan\?/);
    assert.match(planSettings, />Incluido</);
    assert.match(warehouseAccess, /Sin bodegas marcadas, el usuario no podrá operar inventario/);
    assert.match(driverChange, /copy\.warningMessage/);
    assert.match(driverChange, /border-amber-900\/70 bg-amber-400\/10/);
  });

  it("documents the one-surface rule and its exceptions", () => {
    assert.match(uiStyle, /una superficie, no cajas dentro de cajas/i);
    assert.match(uiStyle, /Reserva las tarjetas internas/);
    assert.match(uiStyle, /Nunca escondas información necesaria/);
    assert.match(uiStyle, /CompactInfoDisclosure/);
  });
});
