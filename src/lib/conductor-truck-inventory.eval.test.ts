import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const actionsSource = readFileSync(
  join(process.cwd(), "src/app/actions/conductor-tasks.ts"),
  "utf8",
);
const migrationSource = readFileSync(
  join(process.cwd(), "supabase/migrations/044_conductor_truck_inventory.sql"),
  "utf8",
);
const tareasClientSource = readFileSync(
  join(process.cwd(), "src/components/conductor/conductor-tareas-client.tsx"),
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

  it("keeps payments and route ownership guarded", () => {
    assert.match(actionsSource, /collect_shipment_invoice_payment/);
    assert.match(actionsSource, /driverId = session\.userId/);
    assert.match(actionsSource, /session\.userId !== cleanDriverId/);
  });

  it("keeps tareas blocked by missing truck boxes", () => {
    assert.match(tareasClientSource, /routeBlocked/);
    assert.match(tareasClientSource, /Inventario camion/);
    assert.match(tareasClientSource, /Foto requerida/);
  });
});
