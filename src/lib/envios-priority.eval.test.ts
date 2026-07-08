import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const enviosSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/envios-client.tsx"),
  "utf8",
);
const actionsSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../app/actions/shipments.ts"),
  "utf8",
);

describe("envios invoice priority eval", () => {
  it("keeps priority as a compact icon action on each invoice card", () => {
    assert.equal(enviosSource.includes("updateShipmentInvoicePriorityAction"), true);
    assert.equal(enviosSource.includes("sortShipmentsByArrivalOrder(filteredShipments)"), true);
    assert.equal(enviosSource.includes("<Star"), true);
    assert.equal(enviosSource.includes("Marcar prioridad"), true);
    assert.equal(enviosSource.includes("Quitar prioridad"), true);
    assert.equal(enviosSource.includes("Prioridad"), true);
  });

  it("persists priority with auth, organization scope, audit, and mapped reload", () => {
    assert.equal(actionsSource.includes("export async function updateShipmentInvoicePriorityAction"), true);
    assert.equal(actionsSource.includes('sessionHasPermission(session, "sales.manage")'), true);
    assert.equal(actionsSource.includes(".eq(\"organization_id\", session.organizationId)"), true);
    assert.equal(actionsSource.includes("invoice_priority"), true);
    assert.equal(actionsSource.includes("sale.invoice_priority_updated"), true);
  });

  it("does not dim progress steps while toggling invoice priority", () => {
    assert.equal(enviosSource.includes("priorityBusyId"), true);
    assert.equal(enviosSource.includes("progressBusyId"), true);
    assert.equal(enviosSource.includes("saving={progressBusyId === row.id}"), true);
    assert.equal(enviosSource.includes("setPriorityBusyId(row.id)"), true);
    assert.match(
      enviosSource,
      /async function toggleInvoicePriority[\s\S]*?setPriorityBusyId\(row\.id\)/,
    );
    assert.equal(enviosSource.includes("countryFilterKey"), true);
    assert.equal(enviosSource.includes("EnviosFiltersToolbar"), true);
  });
});
