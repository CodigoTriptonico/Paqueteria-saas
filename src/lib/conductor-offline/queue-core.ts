import type {
  ConductorOfflineOperation,
  ConductorOfflineScope,
  ConductorOfflineSnapshot,
} from "@/lib/conductor-offline/types";

const RETRY_DELAYS_MS = [0, 3_000, 10_000, 30_000, 60_000, 5 * 60_000] as const;
export const CONDUCTOR_OFFLINE_MAX_AUTOMATIC_ATTEMPTS = 8;

export function conductorOfflineScopeKey(scope: ConductorOfflineScope) {
  return `${scope.organizationId}:${scope.userId}:${scope.driverId}`;
}

export function conductorOfflineTaskKey(scope: ConductorOfflineScope, taskId: string) {
  return `${conductorOfflineScopeKey(scope)}:${taskId}`;
}

export function conductorOfflineRetryDelay(attempts: number) {
  const index = Math.min(Math.max(Math.trunc(attempts), 0), RETRY_DELAYS_MS.length - 1);
  return RETRY_DELAYS_MS[index];
}

export function conductorOfflineNextAttemptAt(attempts: number, now = Date.now()) {
  return new Date(now + conductorOfflineRetryDelay(attempts)).toISOString();
}

export function conductorOfflineRequiresAttention(attempts: number) {
  return attempts >= CONDUCTOR_OFFLINE_MAX_AUTOMATIC_ATTEMPTS;
}

export function summarizeConductorOfflineOperations(
  operations: ConductorOfflineOperation[],
): ConductorOfflineSnapshot {
  return {
    operations,
    pendingCount: operations.filter((operation) => operation.status === "pending").length,
    syncingCount: operations.filter((operation) => operation.status === "syncing").length,
    needsAttentionCount: operations.filter((operation) => operation.status === "needs_attention").length,
    syncedCount: operations.filter((operation) => operation.status === "synced").length,
  };
}

export function conductorOfflineStatusLabel(operation: ConductorOfflineOperation) {
  if (operation.status === "syncing") return "Subiendo foto";
  if (operation.status === "needs_attention") return "Revisar sincronización";
  if (operation.status === "synced") return "Sincronizada";
  if (operation.nextAttemptAt) return "Pendiente de internet";
  return "Guardada en este teléfono";
}

export function conductorOfflineGlobalLabel(
  snapshot: ConductorOfflineSnapshot,
  online: boolean,
) {
  if (snapshot.needsAttentionCount > 0) {
    return `${snapshot.needsAttentionCount} ${snapshot.needsAttentionCount === 1 ? "requiere" : "requieren"} revisión`;
  }

  if (snapshot.syncingCount > 0) {
    const total = snapshot.pendingCount + snapshot.syncingCount;
    return `Sincronizando ${snapshot.syncingCount} de ${total}`;
  }

  if (snapshot.pendingCount > 0) {
    return `${online ? "Pendientes" : "Sin conexión"} · ${snapshot.pendingCount} por enviar`;
  }

  return "Todo sincronizado";
}

export function isRetryableConductorSyncStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}
