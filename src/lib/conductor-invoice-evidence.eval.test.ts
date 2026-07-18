import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const clientSource = readFileSync(join(root, "src/components/conductor/conductor-tareas-client.tsx"), "utf8");
const queueSource = readFileSync(join(root, "src/lib/conductor-offline/queue.ts"), "utf8");
const actionSource = readFileSync(join(root, "src/app/actions/conductor-tasks.ts"), "utf8");
const shipmentsSource = readFileSync(join(root, "src/app/actions/shipments.ts"), "utf8");
const logisticsSource = readFileSync(join(root, "src/components/logistica-client.tsx"), "utf8");
const migrationSource = readFileSync(join(root, "supabase/migrations/079_package_invoice_evidence.sql"), "utf8");

describe("invoice visible on physical boxes eval", () => {
  it("requires an explicit driver confirmation and matching photo guidance", () => {
    assert.match(clientSource, /Confirmo que la factura de cada caja/);
    assert.match(clientSource, /dialog\?\.task\.boxInvoiceCodes/);
    assert.match(clientSource, /La foto debe mostrar el invoice escrito en la caja/);
    assert.match(clientSource, /Confirma que el invoice se ve escrito en la caja/);
  });

  it("keeps the invoice confirmation with the offline-first task until sync", () => {
    assert.match(queueSource, /invoiceVisible: draft\.invoiceVisible/);
    assert.match(queueSource, /formData\.set\("invoiceVisible", String\(operation\.invoiceVisible\)\)/);
  });

  it("enforces the rule on the server and records both evidence and incidents", () => {
    assert.match(actionSource, /const invoiceVisible = cleanText\(formData\.get\("invoiceVisible"\), 10\) === "true"/);
    assert.match(actionSource, /invoiceVisible,/);
    assert.match(actionSource, /recordInvoiceEvidence\(admin, session/);
    assert.match(actionSource, /recordInvoiceIncident\(admin, session/);
    assert.match(actionSource, /Invoice no visible/);
  });

  it("creates an auditable physical package for every new sale", () => {
    assert.match(shipmentsSource, /physicalPackageCodesForShipment\(shipment\.code, logisticsPlan\)/);
    assert.match(shipmentsSource, /\.from\("shipment_packages"\)\.insert/);
  });

  it("keeps logistics aware of pending, confirmed and missing invoices", () => {
    assert.match(shipmentsSource, /shipment_packages \(/);
    assert.match(shipmentsSource, /invoiceBoxEvidence/);
    assert.match(logisticsSource, /Invoice por confirmar/);
    assert.match(logisticsSource, /Invoice confirmado/);
    assert.match(logisticsSource, /Invoice no visible/);
  });

  it("persists the delivery, pickup and incident states per physical package", () => {
    assert.match(migrationSource, /invoice_marked_at/);
    assert.match(migrationSource, /invoice_delivery_evidence_url/);
    assert.match(migrationSource, /invoice_pickup_confirmed_at/);
    assert.match(migrationSource, /invoice_incident_reason/);
    assert.match(migrationSource, /invoice_visible boolean/);
  });
});
