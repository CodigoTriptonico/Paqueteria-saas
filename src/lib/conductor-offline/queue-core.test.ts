import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  conductorOfflineGlobalLabel,
  conductorOfflineNextAttemptAt,
  conductorOfflineRetryDelay,
  conductorOfflineRequiresAttention,
  conductorOfflineScopeKey,
  conductorOfflineStatusLabel,
  conductorOfflineTaskKey,
  isRetryableConductorSyncStatus,
  summarizeConductorOfflineOperations,
} from "@/lib/conductor-offline/queue-core";
import type { ConductorOfflineOperation } from "@/lib/conductor-offline/types";

function operation(
  status: ConductorOfflineOperation["status"],
  patch: Partial<ConductorOfflineOperation> = {},
): ConductorOfflineOperation {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    scopeKey: "org:user:driver",
    taskKey: "org:user:driver:task",
    organizationId: "org",
    userId: "user",
    driverId: "driver",
    taskId: "task",
    task: {} as ConductorOfflineOperation["task"],
    result: "completed",
    failureReason: "",
    note: "",
    paymentChoice: "",
    paymentAmount: "",
    paymentMethod: "cash",
    evidence: null,
    status,
    attempts: 0,
    createdAt: "2026-07-15T10:00:00.000Z",
    capturedAt: "2026-07-15T10:00:00.000Z",
    updatedAt: "2026-07-15T10:00:00.000Z",
    nextAttemptAt: null,
    syncedAt: null,
    lastError: "",
    ...patch,
  };
}

describe("conductor offline queue core", () => {
  it("isolates operations by organization, user, driver and task", () => {
    const scope = { organizationId: "org-1", userId: "user-1", driverId: "driver-1" };
    assert.equal(conductorOfflineScopeKey(scope), "org-1:user-1:driver-1");
    assert.equal(conductorOfflineTaskKey(scope, "task-1"), "org-1:user-1:driver-1:task-1");
  });

  it("uses deterministic bounded retry delays", () => {
    assert.equal(conductorOfflineRetryDelay(0), 0);
    assert.equal(conductorOfflineRetryDelay(1), 3_000);
    assert.equal(conductorOfflineRetryDelay(99), 300_000);
    assert.equal(conductorOfflineNextAttemptAt(2, Date.parse("2026-07-15T10:00:00.000Z")), "2026-07-15T10:00:10.000Z");
    assert.equal(conductorOfflineRequiresAttention(7), false);
    assert.equal(conductorOfflineRequiresAttention(8), true);
  });

  it("counts each state and exposes explicit Spanish labels", () => {
    const snapshot = summarizeConductorOfflineOperations([
      operation("pending"),
      operation("syncing", { id: "2" }),
      operation("needs_attention", { id: "3" }),
      operation("synced", { id: "4" }),
    ]);
    assert.deepEqual(
      [snapshot.pendingCount, snapshot.syncingCount, snapshot.needsAttentionCount, snapshot.syncedCount],
      [1, 1, 1, 1],
    );
    assert.equal(conductorOfflineGlobalLabel(snapshot, false), "1 requiere revisión");
    assert.equal(conductorOfflineStatusLabel(operation("pending")), "Guardada en este teléfono");
    assert.equal(
      conductorOfflineStatusLabel(operation("pending", { nextAttemptAt: "2026-07-15T10:01:00.000Z" })),
      "Pendiente de internet",
    );
  });

  it("retries only transient HTTP outcomes", () => {
    assert.equal(isRetryableConductorSyncStatus(408), true);
    assert.equal(isRetryableConductorSyncStatus(429), true);
    assert.equal(isRetryableConductorSyncStatus(503), true);
    assert.equal(isRetryableConductorSyncStatus(422), false);
  });
});
