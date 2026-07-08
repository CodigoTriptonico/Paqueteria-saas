import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const actionsSource = readFileSync(
  join(process.cwd(), "src/app/actions/conductor-tasks.ts"),
  "utf8",
);
const migrationSource = readFileSync(
  join(process.cwd(), "supabase/migrations/045_conductor_truck_inventory.sql"),
  "utf8",
);
const idempotencyMigrationSource = readFileSync(
  join(process.cwd(), "supabase/migrations/049_conductor_delivery_idempotency.sql"),
  "utf8",
);
const tareasViewSource = readFileSync(
  join(process.cwd(), "src/lib/conductor-tareas-view.ts"),
  "utf8",
);
const tareasClientSource = readFileSync(
  join(process.cwd(), "src/components/conductor/conductor-tareas-client.tsx"),
  "utf8",
);
const inventarioClientSource = readFileSync(
  join(process.cwd(), "src/components/conductor/conductor-truck-inventory-client.tsx"),
  "utf8",
);

describe("conductor route eval", () => {
  it("keeps truck inventory tables, evidence bucket and attempts wired", () => {
    assert.match(migrationSource, /logistics_truck_inventory_events/);
    assert.match(migrationSource, /shipment_logistics_task_attempts/);
    assert.match(migrationSource, /logistics-task-evidence/);
    assert.match(actionsSource, /LOGISTICS_TASK_EVIDENCE_BUCKET/);
    assert.match(actionsSource, /shipment_logistics_task_attempts/);
  });

  it("keeps failures visible in contact logs and audit history", () => {
    assert.match(actionsSource, /shipment_contact_logs/);
    assert.match(actionsSource, /shipment\.contact_log_created/);
    assert.match(actionsSource, /shipment\.logistics_task_failed/);
    assert.match(actionsSource, /recordActivityHistory/);
  });

  it("filters conductor task history by source and driver", () => {
    assert.match(actionsSource, /listConductorTaskActivityHistoryAction/);
    assert.match(actionsSource, /source: "conductor\.tareas"/);
    assert.match(actionsSource, /driverId: cleanDriverId/);
    assert.match(actionsSource, /shipment\.logistics_task_failed/);
    assert.match(actionsSource, /shipment\.logistics_task_updated/);
  });

  it("keeps payments and route ownership guarded", () => {
    assert.match(actionsSource, /collect_shipment_invoice_payment/);
    assert.match(actionsSource, /canWriteDriverTask/);
    assert.match(actionsSource, /resolveConductorActionDriverId/);
    assert.match(actionsSource, /session\.userId !== cleanDriverId/);
  });

  it("re-reads task status from db before deliver", () => {
    assert.match(actionsSource, /loadDriverTaskFromDb/);
    assert.match(actionsSource, /shipment_logistics_tasks/);
    assert.match(actionsSource, /taskRow\.status === "completed"/);
    assert.match(actionsSource, /taskRow\.status === "cancelled"/);
  });

  it("keeps deliver events and idempotent guards", () => {
    assert.match(actionsSource, /insertTruckEvent/);
    assert.match(actionsSource, /eventType: "deliver"/);
    assert.match(actionsSource, /hasDeliverEventForTaskLine/);
    assert.match(actionsSource, /error\.code === "23505"/);
  });

  it("lets admin act for a previewed conductor with audit trail", () => {
    assert.match(actionsSource, /resolveConductorActionDriverId/);
    assert.match(actionsSource, /formData\.get\("driverId"\)/);
    assert.match(actionsSource, /conductorActionAuditMetadata/);
    assert.match(tareasViewSource, /actedByAdmin/);
    assert.match(tareasViewSource, /actorUserId/);
    assert.match(tareasViewSource, /formatConductorAdminActionNote/);
    assert.match(tareasClientSource, /driverId/);
  });

  it("keeps delivery idempotency migration index", () => {
    assert.match(idempotencyMigrationSource, /logistics_truck_deliver_task_line_uidx/);
    assert.match(idempotencyMigrationSource, /event_type = 'deliver'/);
  });

  it("keeps tareas blocked by missing truck boxes", () => {
    assert.match(tareasClientSource, /routeBlocked/);
    assert.match(tareasClientSource, /Inventario camion/);
    assert.match(tareasClientSource, /Foto requerida/);
  });

  it("shows delivered and remaining truck metrics in inventario ui", () => {
    assert.match(inventarioClientSource, /deliveredTotal/);
    assert.match(inventarioClientSource, /Entregadas/);
    assert.match(inventarioClientSource, /Restantes/);
  });
});
