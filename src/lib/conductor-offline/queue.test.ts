import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { IDBFactory } from "fake-indexeddb";
import {
  enqueueConductorTaskResult,
  readConductorOfflineSnapshot,
} from "@/lib/conductor-offline/queue";
import type { ConductorDriverTask } from "@/lib/conductor-tasks";

Object.defineProperty(globalThis, "window", {
  value: { dispatchEvent: () => true },
  configurable: true,
});

const scope = { organizationId: "org-1", userId: "user-1", driverId: "driver-1" };
const task = {
  id: "task-1",
  shipmentId: "shipment-1",
  shipmentCode: "BX-001",
  taskType: "deliver_empty_box",
  status: "assigned",
  boxDisplayLines: [],
  boxLines: [],
} as ConductorDriverTask;

beforeEach(() => {
  Object.defineProperty(globalThis, "indexedDB", { value: new IDBFactory(), configurable: true });
});

describe("conductor offline IndexedDB queue", () => {
  it("commits the photo and payload locally before any network work", async () => {
    const evidence = new File([new Uint8Array([1, 2, 3, 4])], "entrega.webp", {
      type: "image/webp",
      lastModified: 123,
    });
    const queued = await enqueueConductorTaskResult({
      scope,
      task,
      result: "completed",
      failureReason: "",
      note: "Puerta principal",
      paymentChoice: null,
      paymentAmount: "",
      paymentMethod: "cash",
      evidence,
    });

    const snapshot = await readConductorOfflineSnapshot(scope);
    assert.equal(snapshot.pendingCount, 1);
    assert.equal(snapshot.operations[0]?.id, queued.id);
    assert.equal(snapshot.operations[0]?.note, "Puerta principal");
    assert.equal(snapshot.operations[0]?.evidence?.blob.size, 4);
    assert.equal(snapshot.operations[0]?.evidence?.name, "entrega.webp");
  });

  it("deduplicates a double tap for the same scoped task", async () => {
    const draft = {
      scope,
      task,
      result: "failed" as const,
      failureReason: "Cliente no contesto",
      note: "",
      paymentChoice: null,
      paymentAmount: "",
      paymentMethod: "cash" as const,
      evidence: null,
    };
    const first = await enqueueConductorTaskResult(draft);
    const second = await enqueueConductorTaskResult(draft);
    const snapshot = await readConductorOfflineSnapshot(scope);

    assert.equal(second.id, first.id);
    assert.equal(snapshot.operations.length, 1);
  });

  it("does not mix another driver into the active scope", async () => {
    await enqueueConductorTaskResult({
      scope,
      task,
      result: "failed",
      failureReason: "Cliente no contesto",
      note: "",
      paymentChoice: null,
      paymentAmount: "",
      paymentMethod: "cash",
      evidence: null,
    });

    const other = await readConductorOfflineSnapshot({ ...scope, driverId: "driver-2" });
    assert.equal(other.operations.length, 0);
  });
});
