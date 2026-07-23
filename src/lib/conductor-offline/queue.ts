"use client";

import {
  conductorOfflineNextAttemptAt,
  conductorOfflineRequiresAttention,
  conductorOfflineScopeKey,
  conductorOfflineTaskKey,
  isRetryableConductorSyncStatus,
  summarizeConductorOfflineOperations,
} from "@/lib/conductor-offline/queue-core";
import type {
  ConductorOfflineDraft,
  ConductorOfflineOperation,
  ConductorOfflineScope,
  ConductorOfflineSnapshot,
} from "@/lib/conductor-offline/types";

const CONDUCTOR_OFFLINE_DB_NAME = "boxario-conductor-offline-v1";
const CONDUCTOR_OFFLINE_STORE = "task-results";
const CONDUCTOR_OFFLINE_META_STORE = "metadata";
const CONDUCTOR_OFFLINE_SYNC_TAG = "boxario-conductor-task-results";
export const CONDUCTOR_OFFLINE_CHANGED_EVENT = "boxario:conductor-offline-changed";

const DB_VERSION = 2;
const SYNCING_LEASE_MS = 2 * 60_000;
const OPERATION_TTL_MS = 7 * 24 * 60 * 60_000;
const flushPromises = new Map<string, Promise<ConductorOfflineSnapshot>>();

function createOperationId() {
  if (typeof crypto === "undefined") {
    throw new Error("Este teléfono no puede crear una operación segura");
  }
  if (crypto.randomUUID) return crypto.randomUUID();

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

function assertBrowserStorage() {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    throw new Error("El almacenamiento local no está disponible en este teléfono");
  }
}

function openDatabase() {
  assertBrowserStorage();

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(CONDUCTOR_OFFLINE_DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      const store = database.objectStoreNames.contains(CONDUCTOR_OFFLINE_STORE)
        ? request.transaction!.objectStore(CONDUCTOR_OFFLINE_STORE)
        : database.createObjectStore(CONDUCTOR_OFFLINE_STORE, { keyPath: "id" });

      if (!store.indexNames.contains("scope-created")) {
        store.createIndex("scope-created", ["scopeKey", "createdAt"]);
      }
      if (!store.indexNames.contains("task-key")) {
        store.createIndex("task-key", "taskKey", { unique: true });
      }
      if (!store.indexNames.contains("status-next-attempt")) {
        store.createIndex("status-next-attempt", ["status", "nextAttemptAt"]);
      }
      if (!database.objectStoreNames.contains(CONDUCTOR_OFFLINE_META_STORE)) {
        database.createObjectStore(CONDUCTOR_OFFLINE_META_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("No se pudo abrir la cola local"));
  });
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Falló el almacenamiento local"));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Falló la transacción local"));
    transaction.onabort = () => reject(transaction.error || new Error("Se canceló la transacción local"));
  });
}

function broadcastQueueChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CONDUCTOR_OFFLINE_CHANGED_EVENT));

  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(CONDUCTOR_OFFLINE_CHANGED_EVENT);
    channel.postMessage({ type: "changed" });
    channel.close();
  }
}

async function allOperations() {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(CONDUCTOR_OFFLINE_STORE, "readwrite");
    const store = transaction.objectStore(CONDUCTOR_OFFLINE_STORE);
    const operations = await requestResult(
      store.getAll() as IDBRequest<ConductorOfflineOperation[]>,
    );
    const cutoff = Date.now() - OPERATION_TTL_MS;
    const current = operations.filter((operation) => Date.parse(operation.createdAt) > cutoff);
    operations
      .filter((operation) => Date.parse(operation.createdAt) <= cutoff)
      .forEach((operation) => store.delete(operation.id));
    await transactionDone(transaction);
    return current;
  } finally {
    database.close();
  }
}

export async function readConductorOfflineSnapshot(scope: ConductorOfflineScope) {
  const scopeKey = conductorOfflineScopeKey(scope);
  const operations = (await allOperations())
    .filter((operation) => operation.scopeKey === scopeKey)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  return summarizeConductorOfflineOperations(operations);
}

export async function enqueueConductorTaskResult(draft: ConductorOfflineDraft) {
  const database = await openDatabase();
  const scopeKey = conductorOfflineScopeKey(draft.scope);
  const taskKey = conductorOfflineTaskKey(draft.scope, draft.task.id);
  const now = new Date().toISOString();
  const id = createOperationId();
  const operation: ConductorOfflineOperation = {
    id,
    scopeKey,
    taskKey,
    organizationId: draft.scope.organizationId,
    userId: draft.scope.userId,
    driverId: draft.scope.driverId,
    taskId: draft.task.id,
    task: draft.task,
    result: draft.result,
    invoiceVisible: draft.invoiceVisible,
    failureReason: draft.failureReason,
    note: draft.note,
    paymentChoice: draft.paymentChoice || "",
    paymentAmount: draft.paymentAmount,
    paymentMethod: draft.paymentMethod,
    evidence: draft.evidence
      ? {
          blob: draft.evidence,
          name: draft.evidence.name,
          type: draft.evidence.type,
          lastModified: draft.evidence.lastModified,
        }
      : null,
    status: "pending",
    attempts: 0,
    createdAt: now,
    capturedAt: draft.capturedAt || now,
    updatedAt: now,
    nextAttemptAt: null,
    syncedAt: null,
    lastError: "",
  };

  try {
    const transaction = database.transaction(CONDUCTOR_OFFLINE_STORE, "readwrite");
    const store = transaction.objectStore(CONDUCTOR_OFFLINE_STORE);
    const existing = await requestResult(
      store.index("task-key").get(taskKey) as IDBRequest<ConductorOfflineOperation | undefined>,
    );

    if (existing) {
      transaction.abort();
      return existing;
    }

    store.add(operation);
    await transactionDone(transaction);
    broadcastQueueChanged();
    return operation;
  } finally {
    database.close();
  }
}

async function updateOperation(
  operationId: string,
  updater: (operation: ConductorOfflineOperation) => ConductorOfflineOperation,
) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(CONDUCTOR_OFFLINE_STORE, "readwrite");
    const store = transaction.objectStore(CONDUCTOR_OFFLINE_STORE);
    const current = await requestResult(
      store.get(operationId) as IDBRequest<ConductorOfflineOperation | undefined>,
    );
    if (current) store.put(updater(current));
    await transactionDone(transaction);
  } finally {
    database.close();
  }
  broadcastQueueChanged();
}

async function claimNextOperation(scope: ConductorOfflineScope) {
  const database = await openDatabase();
  const scopeKey = conductorOfflineScopeKey(scope);
  const now = Date.now();

  try {
    const transaction = database.transaction(CONDUCTOR_OFFLINE_STORE, "readwrite");
    const store = transaction.objectStore(CONDUCTOR_OFFLINE_STORE);
    const operations = await requestResult(
      store.getAll() as IDBRequest<ConductorOfflineOperation[]>,
    );
    const candidate = operations
      .filter((operation) => operation.scopeKey === scopeKey)
      .filter((operation) => {
        if (operation.status === "pending") {
          return !operation.nextAttemptAt || Date.parse(operation.nextAttemptAt) <= now;
        }
        return operation.status === "syncing" && Date.parse(operation.updatedAt) + SYNCING_LEASE_MS <= now;
      })
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0];

    if (!candidate) {
      transaction.abort();
      return null;
    }

    const claimed: ConductorOfflineOperation = {
      ...candidate,
      status: "syncing",
      attempts: candidate.attempts + 1,
      updatedAt: new Date(now).toISOString(),
      nextAttemptAt: null,
      lastError: "",
    };
    store.put(claimed);
    await transactionDone(transaction);
    broadcastQueueChanged();
    return claimed;
  } finally {
    database.close();
  }
}

function operationFormData(operation: ConductorOfflineOperation) {
  const formData = new FormData();
  formData.set("operationId", operation.id);
  formData.set("taskId", operation.taskId);
  formData.set("driverId", operation.driverId);
  formData.set("result", operation.result);
  formData.set("invoiceVisible", String(operation.invoiceVisible));
  formData.set("failureReason", operation.failureReason);
  formData.set("note", operation.note);
  formData.set("paymentChoice", operation.paymentChoice);
  formData.set("paymentAmount", operation.paymentAmount);
  formData.set("paymentMethod", operation.paymentMethod);
  formData.set("capturedAt", operation.capturedAt);
  if (operation.evidence) {
    formData.set(
      "evidence",
      new File([operation.evidence.blob], operation.evidence.name, {
        type: operation.evidence.type,
        lastModified: operation.evidence.lastModified,
      }),
    );
  }
  return formData;
}

async function sendOperation(operation: ConductorOfflineOperation) {
  const response = await fetch("/api/conductor/task-results", {
    method: "POST",
    credentials: "include",
    body: operationFormData(operation),
  });
  const payload = await response.json().catch(() => ({ ok: false, error: "Respuesta inválida del servidor" }));
  return { response, payload };
}

async function flushScope(scope: ConductorOfflineScope) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return readConductorOfflineSnapshot(scope);
  }

  while (true) {
    const operation = await claimNextOperation(scope);
    if (!operation) break;

    try {
      const { response, payload } = await sendOperation(operation);
      if (response.ok && payload?.ok) {
        await updateOperation(operation.id, (current) => ({
          ...current,
          status: "synced",
          evidence: null,
          syncedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          nextAttemptAt: null,
          lastError: "",
        }));
        continue;
      }

      const retryable = payload?.retryable === true || isRetryableConductorSyncStatus(response.status);
      await updateOperation(operation.id, (current) => ({
        ...current,
        status: retryable && !conductorOfflineRequiresAttention(current.attempts)
          ? "pending"
          : "needs_attention",
        updatedAt: new Date().toISOString(),
        nextAttemptAt: retryable && !conductorOfflineRequiresAttention(current.attempts)
          ? conductorOfflineNextAttemptAt(current.attempts)
          : null,
        lastError: String(payload?.error || `Error ${response.status}`),
      }));
    } catch (error) {
      await updateOperation(operation.id, (current) => ({
        ...current,
        status: conductorOfflineRequiresAttention(current.attempts) ? "needs_attention" : "pending",
        updatedAt: new Date().toISOString(),
        nextAttemptAt: conductorOfflineRequiresAttention(current.attempts)
          ? null
          : conductorOfflineNextAttemptAt(current.attempts),
        lastError: error instanceof Error ? error.message : "Sin conexión",
      }));
      break;
    }
  }

  return readConductorOfflineSnapshot(scope);
}

export function flushConductorTaskResults(scope: ConductorOfflineScope) {
  const scopeKey = conductorOfflineScopeKey(scope);
  const current = flushPromises.get(scopeKey);
  if (current) return current;

  const next = flushScope(scope).finally(() => {
    flushPromises.delete(scopeKey);
  });
  flushPromises.set(scopeKey, next);
  return next;
}

export async function retryConductorOfflineOperation(operationId: string) {
  await updateOperation(operationId, (current) => ({
    ...current,
    status: "pending",
    nextAttemptAt: null,
    lastError: "",
    updatedAt: new Date().toISOString(),
  }));
}

export async function pruneSyncedConductorOperations(
  scope: ConductorOfflineScope,
  serverCompletedTaskIds: ReadonlySet<string>,
) {
  const database = await openDatabase();
  const scopeKey = conductorOfflineScopeKey(scope);
  try {
    const transaction = database.transaction(CONDUCTOR_OFFLINE_STORE, "readwrite");
    const store = transaction.objectStore(CONDUCTOR_OFFLINE_STORE);
    const operations = await requestResult(
      store.getAll() as IDBRequest<ConductorOfflineOperation[]>,
    );
    for (const operation of operations) {
      if (
        operation.scopeKey === scopeKey &&
        operation.status === "synced" &&
        serverCompletedTaskIds.has(operation.taskId)
      ) {
        store.delete(operation.id);
      }
    }
    await transactionDone(transaction);
  } finally {
    database.close();
  }
  broadcastQueueChanged();
}

export async function removeConductorOperationsForTask(scope: ConductorOfflineScope, taskId: string) {
  const database = await openDatabase();
  const taskKey = conductorOfflineTaskKey(scope, taskId);
  try {
    const transaction = database.transaction(CONDUCTOR_OFFLINE_STORE, "readwrite");
    const store = transaction.objectStore(CONDUCTOR_OFFLINE_STORE);
    const operation = await requestResult(
      store.index("task-key").get(taskKey) as IDBRequest<ConductorOfflineOperation | undefined>,
    );
    if (operation) store.delete(operation.id);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
  broadcastQueueChanged();
}

export async function requestConductorBackgroundSync() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const syncRegistration = registration as ServiceWorkerRegistration & {
    sync?: { register: (tag: string) => Promise<void> };
  };
  await syncRegistration.sync?.register(CONDUCTOR_OFFLINE_SYNC_TAG).catch(() => undefined);
}

export async function requestPersistentConductorStorage() {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
  return navigator.storage.persist();
}

function postServiceWorkerMessage(message: Record<string, unknown>) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return Promise.resolve(false);

  return navigator.serviceWorker.ready.then((registration) => new Promise<boolean>((resolve) => {
    const worker = navigator.serviceWorker.controller || registration.active;
    if (!worker) {
      resolve(false);
      return;
    }

    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => resolve(false), 5_000);
    channel.port1.onmessage = (event) => {
      window.clearTimeout(timeout);
      resolve(event.data?.ok === true);
    };
    worker.postMessage(message, [channel.port2]);
  }));
}

export function cacheConductorOfflineShell(scope: ConductorOfflineScope) {
  return postServiceWorkerMessage({
    type: "BOXARIO_CACHE_CONDUCTOR_SHELL",
    scopeKey: conductorOfflineScopeKey(scope),
    userKey: `${scope.organizationId}:${scope.userId}`,
    url: window.location.href,
  });
}

export async function clearConductorPrivateCache() {
  const acknowledged = await postServiceWorkerMessage({ type: "BOXARIO_CLEAR_CONDUCTOR_PRIVATE_CACHE" });
  if (!acknowledged && typeof caches !== "undefined") {
    await caches.delete("boxario-conductor-private-v1");
  }
}

export async function countUnconfirmedConductorOperations(organizationId: string, userId: string) {
  const operations = await allOperations();
  return operations.filter(
    (operation) =>
      operation.organizationId === organizationId &&
      operation.userId === userId &&
      operation.status !== "synced",
  ).length;
}

export async function clearConductorOfflineUserData(organizationId: string, userId: string) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(CONDUCTOR_OFFLINE_STORE, "readwrite");
    const store = transaction.objectStore(CONDUCTOR_OFFLINE_STORE);
    const operations = await requestResult(
      store.getAll() as IDBRequest<ConductorOfflineOperation[]>,
    );
    for (const operation of operations) {
      if (operation.organizationId === organizationId && operation.userId === userId) {
        store.delete(operation.id);
      }
    }
    await transactionDone(transaction);
  } finally {
    database.close();
  }
  broadcastQueueChanged();
}
