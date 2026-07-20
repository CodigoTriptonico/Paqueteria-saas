const STATIC_CACHE = "boxario-static-v2";
const PRIVATE_CACHE = "boxario-conductor-private-v1";
const OFFLINE_URL = "/offline.html";
const PRECACHE_URLS = [OFFLINE_URL, "/app-icon.svg", "/manifest.webmanifest"];
const DB_NAME = "boxario-conductor-offline-v1";
const DB_VERSION = 2;
const STORE_NAME = "task-results";
const META_STORE_NAME = "metadata";
const SYNC_TAG = "boxario-conductor-task-results";
const SYNCING_LEASE_MS = 2 * 60 * 1000;
const RETRY_DELAYS_MS = [0, 3000, 10000, 30000, 60000, 300000];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(
        keys.filter((key) => key.startsWith("boxario-static-") && key !== STATIC_CACHE).map((key) => caches.delete(key)),
      )),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.searchParams.has("_rsc")) return;
  if (request.headers.has("RSC") || request.headers.has("Next-Router-State-Tree")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }

        return fetch(request).then(async (response) => {
          if (response.ok) {
            const copy = response.clone();
            const cache = await caches.open(STATIC_CACHE);
            await cache.put(request, copy);
          }
          return response;
        });
      }),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        if (url.pathname.startsWith("/conductor")) {
          const scopeKey = await readMetadata("active-scope");
          if (scopeKey) {
            const cached = await caches.match(privateCacheRequest(scopeKey));
            if (cached) return cached;
          }
        }
        return caches.match(OFFLINE_URL);
      }),
    );
  }
});

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      const store = database.objectStoreNames.contains(STORE_NAME)
        ? request.transaction.objectStore(STORE_NAME)
        : database.createObjectStore(STORE_NAME, { keyPath: "id" });
      if (!store.indexNames.contains("scope-created")) store.createIndex("scope-created", ["scopeKey", "createdAt"]);
      if (!store.indexNames.contains("task-key")) store.createIndex("task-key", "taskKey", { unique: true });
      if (!store.indexNames.contains("status-next-attempt")) store.createIndex("status-next-attempt", ["status", "nextAttemptAt"]);
      if (!database.objectStoreNames.contains(META_STORE_NAME)) {
        database.createObjectStore(META_STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function privateCacheRequest(scopeKey) {
  return new Request(new URL(`/__boxario_private__/${encodeURIComponent(scopeKey)}`, self.location.origin));
}

async function writeMetadata(key, value) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(META_STORE_NAME, "readwrite");
    transaction.objectStore(META_STORE_NAME).put({ key, value });
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

async function readMetadata(key) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(META_STORE_NAME, "readonly");
    const row = await requestResult(transaction.objectStore(META_STORE_NAME).get(key));
    return row?.value || null;
  } finally {
    database.close();
  }
}

async function clearPrivateConductorCache() {
  await caches.delete(PRIVATE_CACHE);
  const database = await openDatabase();
  try {
    const transaction = database.transaction(META_STORE_NAME, "readwrite");
    transaction.objectStore(META_STORE_NAME).delete("active-scope");
    transaction.objectStore(META_STORE_NAME).delete("active-user");
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

async function cacheConductorShell(message) {
  if (!message.scopeKey || !message.userKey || !message.url) return false;
  const url = new URL(message.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith("/conductor")) return false;
  const response = await fetch(url, { credentials: "include", cache: "no-store" });
  if (!response.ok || response.redirected || !response.headers.get("content-type")?.includes("text/html")) return false;
  const cache = await caches.open(PRIVATE_CACHE);
  await cache.put(privateCacheRequest(message.scopeKey), response.clone());
  await writeMetadata("active-scope", message.scopeKey);
  await writeMetadata("active-user", message.userKey);
  return true;
}

async function claimNextOperation() {
  const database = await openDatabase();
  const now = Date.now();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const operations = await requestResult(store.getAll());
    const operation = operations
      .filter((item) => {
        if (item.status === "pending") return !item.nextAttemptAt || Date.parse(item.nextAttemptAt) <= now;
        return item.status === "syncing" && Date.parse(item.updatedAt) + SYNCING_LEASE_MS <= now;
      })
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0];

    if (!operation) {
      transaction.abort();
      return null;
    }

    const claimed = {
      ...operation,
      status: "syncing",
      attempts: operation.attempts + 1,
      updatedAt: new Date(now).toISOString(),
      nextAttemptAt: null,
      lastError: "",
    };
    store.put(claimed);
    await transactionDone(transaction);
    return claimed;
  } finally {
    database.close();
  }
}

async function updateOperation(id, updater) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const current = await requestResult(store.get(id));
    if (current) store.put(updater(current));
    await transactionDone(transaction);
  } finally {
    database.close();
  }
  await notifyClients();
}

function operationFormData(operation) {
  const formData = new FormData();
  formData.set("operationId", operation.id);
  formData.set("taskId", operation.taskId);
  formData.set("driverId", operation.driverId);
  formData.set("result", operation.result);
  formData.set("failureReason", operation.failureReason);
  formData.set("note", operation.note);
  formData.set("paymentChoice", operation.paymentChoice);
  formData.set("paymentAmount", operation.paymentAmount);
  formData.set("paymentMethod", operation.paymentMethod);
  formData.set("capturedAt", operation.capturedAt);
  if (operation.evidence) {
    formData.set("evidence", new File([operation.evidence.blob], operation.evidence.name, {
      type: operation.evidence.type,
      lastModified: operation.evidence.lastModified,
    }));
  }
  return formData;
}

function nextAttemptAt(attempts) {
  const index = Math.min(Math.max(Math.trunc(attempts), 0), RETRY_DELAYS_MS.length - 1);
  return new Date(Date.now() + RETRY_DELAYS_MS[index]).toISOString();
}

function isRetryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function requiresAttention(attempts) {
  return attempts >= 8;
}

async function notifyClients() {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  clients.forEach((client) => client.postMessage({ type: "BOXARIO_CONDUCTOR_QUEUE_CHANGED" }));
}

async function flushQueue() {
  while (true) {
    const operation = await claimNextOperation();
    if (!operation) break;

    try {
      const response = await fetch("/api/conductor/task-results", {
        method: "POST",
        credentials: "include",
        body: operationFormData(operation),
      });
      const payload = await response.json().catch(() => ({ ok: false, error: "Respuesta inválida del servidor" }));
      if (response.ok && payload.ok) {
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

      const retryable = payload.retryable === true || isRetryableStatus(response.status);
      await updateOperation(operation.id, (current) => ({
        ...current,
        status: retryable && !requiresAttention(current.attempts) ? "pending" : "needs_attention",
        updatedAt: new Date().toISOString(),
        nextAttemptAt: retryable && !requiresAttention(current.attempts)
          ? nextAttemptAt(current.attempts)
          : null,
        lastError: String(payload.error || `Error ${response.status}`),
      }));
    } catch (error) {
      await updateOperation(operation.id, (current) => ({
        ...current,
        status: requiresAttention(current.attempts) ? "needs_attention" : "pending",
        updatedAt: new Date().toISOString(),
        nextAttemptAt: requiresAttention(current.attempts) ? null : nextAttemptAt(current.attempts),
        lastError: error instanceof Error ? error.message : "Sin conexión",
      }));
      throw error;
    }
  }
}

self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) event.waitUntil(flushQueue());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "BOXARIO_SYNC_CONDUCTOR_QUEUE") {
    event.waitUntil(flushQueue());
    return;
  }

  if (event.data?.type === "BOXARIO_CACHE_CONDUCTOR_SHELL") {
    event.waitUntil(
      cacheConductorShell(event.data)
        .then((ok) => event.ports[0]?.postMessage({ ok }))
        .catch(() => event.ports[0]?.postMessage({ ok: false })),
    );
    return;
  }

  if (event.data?.type === "BOXARIO_CLEAR_CONDUCTOR_PRIVATE_CACHE") {
    event.waitUntil(
      clearPrivateConductorCache()
        .then(() => event.ports[0]?.postMessage({ ok: true }))
        .catch(() => event.ports[0]?.postMessage({ ok: false })),
    );
  }
});
