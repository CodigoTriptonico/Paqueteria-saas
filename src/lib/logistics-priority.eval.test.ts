import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const logisticaSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/logistica-client.tsx"),
  "utf8",
);
const badgeSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/invoice-priority-badge.tsx"),
  "utf8",
);
const viewSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "logistics-view.ts"),
  "utf8",
);
describe("logistics invoice priority eval", () => {
  it("shows priority once on logistics invoice cards", () => {
    const invoiceCardStart = logisticaSource.indexOf("function renderInvoiceCard");
    const taskCardStart = logisticaSource.indexOf("function renderTaskCard");
    const invoiceCard = logisticaSource.slice(invoiceCardStart, taskCardStart);

    assert.equal(invoiceCard.includes('aria-label="Prioridad"'), false);
    assert.equal(invoiceCard.includes('<InvoicePriorityBadge variant="chip"'), true);
    assert.equal(invoiceCard.includes("absolute right-2 top-2"), true);
    assert.equal(invoiceCard.includes("pulsing={priorityAwaitingDriver}"), true);
    assert.equal(invoiceCard.includes("logisticsPriorityHeaderClass"), true);
    assert.equal(badgeSource.includes("Prioridad"), true);
    assert.equal(badgeSource.includes("<Star"), true);
  });

  it("shows priority on unrouted tasks and route stops", () => {
    assert.equal(logisticaSource.includes("<InvoicePriorityBadge"), true);
    assert.equal(logisticaSource.includes("task?.shipment.invoice_priority ?"), true);
  });

  it("sorts logistics invoices and unrouted tasks by invoice priority", () => {
    assert.equal(logisticaSource.includes("sortLogisticsInvoiceItemsByPriority"), true);
    assert.equal(logisticaSource.includes("prioritizeLogisticsTasks"), true);
    assert.equal(viewSource.includes("export function compareShipmentInvoicePriority"), true);
    assert.equal(viewSource.includes("export function sortLogisticsInvoiceItemsByPriority"), true);
    assert.equal(viewSource.includes("export function prioritizeLogisticsTasks"), true);
  });

  it("lets operators search invoices marked as priority", () => {
    assert.equal(logisticaSource.includes('item.shipment.invoice_priority ? "prioridad" : null'), true);
  });

  it("keeps priority amber and unassigned driver rose", () => {
    assert.equal(logisticaSource.includes("logisticsPriorityCardClass"), true);
    assert.match(logisticaSource, /logistics-unassigned-alert border-rose-/);
    assert.doesNotMatch(logisticaSource, /logistics-unassigned-alert border-amber-/);
  });

  it("pulses priority only while the invoice still needs a driver", () => {
    assert.equal(viewSource.includes("export function logisticsPriorityAwaitingDriver"), true);
    assert.equal(logisticaSource.includes("pulsing={priorityAwaitingDriver}"), true);
    assert.equal(badgeSource.includes("pulsing = false"), true);
    assert.equal(badgeSource.includes("logistics-priority-awaiting-driver"), true);
  });

  it("does not show a separate city or zip chip above the address", () => {
    assert.equal(logisticaSource.includes("logisticsAddressLocationLabel"), false);
    assert.equal(logisticaSource.includes("Sin zona"), false);
  });
});
