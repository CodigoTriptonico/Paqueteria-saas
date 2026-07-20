import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const clientSource = readFileSync(join(root, "src/components/conductor/conductor-tareas-client.tsx"), "utf8");
const queueSource = readFileSync(join(root, "src/lib/conductor-offline/queue.ts"), "utf8");
const queueCoreSource = readFileSync(join(root, "src/lib/conductor-offline/queue-core.ts"), "utf8");
const workerSource = readFileSync(join(root, "public/sw.js"), "utf8");
const proxySource = readFileSync(join(root, "src/proxy.ts"), "utf8");
const migrationSource = readFileSync(join(root, "supabase/migrations/069_conductor_offline_task_results.sql"), "utf8");
const conductorActionSource = readFileSync(join(root, "src/app/actions/conductor-tasks.ts"), "utf8");

describe("conductor offline-first eval", () => {
  it("keeps server retries idempotent after a partial attempt write", () => {
    assert.match(conductorActionSource, /error\.code === "23505" && input\.clientOperationId/);
    assert.match(conductorActionSource, /existingAttempt\?\.task_id === input\.task\.id/);
    assert.match(conductorActionSource, /notes:\s*input\.note,/);
  });

  it("syncs yesterday's assigned work after the phone reconnects past midnight", () => {
    assert.match(conductorActionSource, /scheduledAtScopeDate\(taskRow\.scheduled_at\)/);
    assert.match(conductorActionSource, /loadConductorData\(driverId, taskScopeDate\)/);
    assert.match(conductorActionSource, /loadTruckInventoryView\(session, driverId, task\.routeId, taskScopeDate\)/);
  });

  it("acknowledges the phone write before starting background network sync", () => {
    const enqueueIndex = clientSource.indexOf("await enqueueConductorTaskResult");
    const successIndex = clientSource.indexOf('notify.success("Guardada en este teléfono")', enqueueIndex);
    const syncIndex = clientSource.indexOf("void syncOfflineResults()", successIndex);
    assert.ok(enqueueIndex >= 0);
    assert.ok(successIndex > enqueueIndex);
    assert.ok(syncIndex > successIndex);
    assert.doesNotMatch(clientSource, /await submitConductorTaskResultAction/);
  });

  it("keeps photo blobs durable until the server ACK", () => {
    assert.match(queueSource, /evidence:\s*draft\.evidence/);
    assert.match(queueSource, /status: "synced",\s*evidence: null/);
    assert.match(queueSource, /task-key[\s\S]*unique: true/);
  });

  it("syncs when open and through Background Sync when supported", () => {
    assert.match(clientSource, /window\.addEventListener\("online"/);
    assert.match(clientSource, /visibilitychange/);
    assert.match(workerSource, /addEventListener\("sync"/);
    assert.match(workerSource, /api\/conductor\/task-results/);
  });

  it("does not put generic authenticated HTML, RSC or API responses in the shared cache", () => {
    assert.match(workerSource, /request\.mode === "navigate"[\s\S]*fetch\(request\)\.catch/);
    assert.match(workerSource, /url\.pathname\.startsWith\("\/api\/"\)/);
    assert.match(workerSource, /url\.searchParams\.has\("_rsc"\)/);
    assert.match(workerSource, /PRIVATE_CACHE = "boxario-conductor-private-v1"/);
    assert.match(workerSource, /encodeURIComponent\(scopeKey\)/);
    assert.match(workerSource, /BOXARIO_CLEAR_CONDUCTOR_PRIVATE_CACHE/);
  });

  it("clones static responses before returning them to the page", () => {
    assert.match(workerSource, /function cacheStaticCopy\(request, response\)/);
    assert.match(workerSource, /copy = response\.clone\(\)/);
    assert.match(workerSource, /cacheStaticCopy\(request, response\)/);
    assert.doesNotMatch(
      workerSource,
      /caches\.open\(STATIC_CACHE\)\.then\(\(cache\) => cache\.put\(request, response\.clone\(\)\)\)/,
    );
  });

  it("keeps PWA public files outside authentication and operation ids in the database", () => {
    assert.match(proxySource, /pathname === "\/sw\.js"/);
    assert.match(proxySource, /pathname === "\/manifest\.webmanifest"/);
    assert.match(migrationSource, /client_operation_id uuid/);
    assert.match(migrationSource, /shipment_task_attempts_client_operation_uidx/);
  });

  it("uses explicit Spanish operational states without moving the toolbar", () => {
    assert.match(clientSource, /aria-live="polite"/);
    assert.match(clientSource, /h-10 min-w-0 items-center/);
    assert.match(queueCoreSource, /Revisar sincronización/);
    assert.match(clientSource, /Guardada en este teléfono/);
  });
});
